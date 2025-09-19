
import { createRequire } from 'node:module';
import { genkit } from 'genkit';
import type { GenerateRequest, GenerateResponseData, Part } from '@genkit-ai/ai/model';

const moduleSpecifier = '@genkit-ai/compat-oai/openai';

const isModuleNotFoundError = (error: unknown) => {
  if (!error) return false;
  const message = typeof error === 'string' ? error : (error as Error)?.message ?? '';
  const code = (error as any)?.code;
  return (
    code === 'ERR_MODULE_NOT_FOUND' ||
    code === 'MODULE_NOT_FOUND' ||
    message.includes(`Cannot find module '${moduleSpecifier}'`) ||
    message.includes(`Cannot find package '${moduleSpecifier}'`)
  );
};

type OpenAiPluginFactory = (options: { apiKey: string }) => any;

const { plugin: openAiPluginFactory, error: openAiLoadError } = await (async () => {
  let detectedError: unknown;

  const recordError = (error: unknown) => {
    if (!detectedError && error && !isModuleNotFoundError(error)) {
      detectedError = error;
    }
  };

  const normalizeModule = (mod: any): OpenAiPluginFactory | null => {
    const candidates = [
      mod?.default,
      mod?.plugin,
      mod?.openai,
      mod?.openAi,
      mod?.OpenAI,
      mod,
    ];
    const candidate = candidates.find((entry) => typeof entry === 'function');
    return candidate ?? null;
  };

  try {
    const requireForCompat = createRequire(import.meta.url);
    const mod = requireForCompat(moduleSpecifier);
    const plugin = normalizeModule(mod);
    if (plugin) {
      return { plugin, error: detectedError };
    }
  } catch (error) {
    recordError(error);
  }

  try {
    const mod = await import(moduleSpecifier);
    const plugin = normalizeModule(mod);
    if (plugin) {
      return { plugin, error: detectedError };
    }
  } catch (error) {
    recordError(error);
  }

  return { plugin: null, error: detectedError };
})();

const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
const plugins =
  openAiPluginFactory && hasApiKey
    ? [openAiPluginFactory({ apiKey: process.env.OPENAI_API_KEY! })]
    : [];

const ai = genkit({
  plugins,
  model: hasApiKey ? 'openai/gpt-5' : undefined,
});

type OpenAiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const FALLBACK_MODELS: Array<{ name: string; openAiName: string; label: string }> = [
  { name: 'openai/gpt-5', openAiName: 'gpt-4o-mini', label: 'OpenAI gpt-4o mini (fallback)' },
  { name: 'openai/gpt-4o', openAiName: 'gpt-4o', label: 'OpenAI gpt-4o (fallback)' },
  { name: 'openai/gpt-4o-mini', openAiName: 'gpt-4o-mini', label: 'OpenAI gpt-4o mini (fallback)' },
];

const mapFinishReason = (reason: any): 'stop' | 'length' | 'blocked' | 'interrupted' | 'other' | 'unknown' => {
  switch (reason) {
    case 'stop':
    case 'length':
      return reason;
    case 'content_filter':
      return 'blocked';
    case 'tool_calls':
      return 'other';
    case 'null':
    case null:
    case undefined:
      return 'unknown';
    default:
      return 'other';
  }
};

const partToString = (part: Part): string | null => {
  if (typeof (part as any)?.text === 'string') {
    return (part as any).text;
  }
  if ((part as any)?.data !== undefined) {
    try {
      return typeof (part as any).data === 'string'
        ? (part as any).data
        : JSON.stringify((part as any).data);
    } catch (error) {
      console.warn('[genkit] Unable to serialise part.data for OpenAI fallback:', error);
    }
  }
  return null;
};

const toOpenAiMessages = (request: GenerateRequest): OpenAiChatMessage[] => {
  const messages: OpenAiChatMessage[] = [];
  for (const message of request.messages ?? []) {
    if (!message?.content?.length) continue;
    const text = message.content
      .map((part) => partToString(part))
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join('\n');
    if (!text) continue;
    if (message.role === 'tool') {
      continue;
    }
    const role = message.role === 'model' ? 'assistant' : message.role;
    if (role === 'system' || role === 'user' || role === 'assistant') {
      messages.push({ role, content: text });
    }
  }
  return messages;
};

const extractOpenAiContent = (payload: any): string => {
  const content = payload?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (!entry) return '';
        if (typeof entry === 'string') return entry;
        if (typeof entry.text === 'string') return entry.text;
        if (typeof entry?.value === 'string') return entry.value;
        if (typeof entry?.content === 'string') return entry.content;
        if (typeof entry?.type === 'string') {
          if (typeof entry?.text === 'string') return entry.text;
          if (typeof entry?.value === 'string') return entry.value;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof content?.text === 'string') {
    return content.text;
  }
  return '';
};

const applyGenerationConfig = (body: Record<string, any>, config: unknown) => {
  if (!config || typeof config !== 'object') return;
  const cfg = config as Record<string, any>;
  if (typeof cfg.temperature === 'number') body.temperature = cfg.temperature;
  if (typeof cfg.topP === 'number') body.top_p = cfg.topP;
  if (typeof cfg.presencePenalty === 'number') body.presence_penalty = cfg.presencePenalty;
  if (typeof cfg.frequencyPenalty === 'number') body.frequency_penalty = cfg.frequencyPenalty;
  const maxTokens = cfg.maxOutputTokens ?? cfg.maxTokens;
  if (typeof maxTokens === 'number') {
    body.max_completion_tokens = maxTokens;
    body.max_tokens = maxTokens;
  }
  const stop = cfg.stopSequences ?? cfg.stop;
  if (Array.isArray(stop) && stop.every((entry) => typeof entry === 'string')) {
    body.stop = stop;
  }
};

const applyOutputConfig = (body: Record<string, any>, output: GenerateRequest['output']) => {
  if (!output) return;
  if (output.schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'structured_response',
        schema: output.schema,
        strict: true,
      },
    };
    return;
  }
  const wantsJson =
    output.format === 'json' ||
    output.contentType === 'application/json' ||
    output.contentType === 'application/ld+json';
  if (wantsJson) {
    body.response_format = { type: 'json_object' };
  }
};

const registerFallbackModels = (apiKey: string): string[] => {
  if (!apiKey) return [];
  const baseUrl = process.env.OPENAI_BASE_URL?.replace(/\/$/, '') || 'https://api.openai.com/v1';
  const endpoint = `${baseUrl}/chat/completions`;
  const registeredModels: string[] = [];

  for (const { name, openAiName, label } of FALLBACK_MODELS) {
    ai.defineModel({ name, label }, async (request, context) => {
      const messages = toOpenAiMessages(request);
      if (!messages.length) {
        throw new Error('[genkit] OpenAI fallback received an empty prompt.');
      }

      const body: Record<string, any> = {
        model: openAiName,
        messages,
      };

      applyGenerationConfig(body, request.config);
      applyOutputConfig(body, request.output);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: context?.abortSignal,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage = payload?.error?.message ?? `status ${response.status}`;
        throw new Error(`[genkit] OpenAI fallback request failed: ${errorMessage}`);
      }

      const choice = payload?.choices?.[0];
      if (!choice) {
        throw new Error('[genkit] OpenAI fallback returned no choices.');
      }

      const text = extractOpenAiContent(choice.message || choice.delta || {});
      const finishReason = mapFinishReason(choice.finish_reason);

      const message = {
        role: 'model' as const,
        content: text ? [{ text }] : [],
      };

      const usage = payload?.usage;
      const result: GenerateResponseData = {
        message,
        finishReason,
        raw: payload,
      };

      if (usage) {
        result.usage = {
          inputTokens: usage.prompt_tokens ?? usage.input_tokens,
          outputTokens: usage.completion_tokens ?? usage.output_tokens,
          totalTokens: usage.total_tokens,
        };
      }

      return result;
    });
    registeredModels.push(name);
  }

  if (registeredModels.length) {
    console.warn(
      '[genkit] @genkit-ai/compat-oai wurde nicht gefunden. Verwende integrierte Fallback-Clients für OpenAI.',
    );
  }

  return registeredModels;
};

const fallbackModels = !plugins.length && hasApiKey ? registerFallbackModels(process.env.OPENAI_API_KEY!) : [];

export const isAiConfigured = plugins.length > 0 || fallbackModels.length > 0;

if (!isAiConfigured) {
  const reason = !hasApiKey
    ? 'Es ist kein OPENAI_API_KEY gesetzt.'
    : `Das optionale Paket "${moduleSpecifier}" konnte nicht geladen werden.`;
  const extra = openAiLoadError instanceof Error ? ` (${openAiLoadError.message})` : '';
  console.warn(
    `[genkit] OpenAI-Plugin ist nicht konfiguriert: ${reason}${extra}.` +
      ' Die KI-Funktionen liefern dann einen Hinweis für fehlende Konfiguration.',
  );
}

export { ai };

export const missingAiMessage =
  'The AI backend is not configured. Please install @genkit-ai/compat-oai and set OPENAI_API_KEY to enable AI responses.';
