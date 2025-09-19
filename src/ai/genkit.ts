import { genkit } from 'genkit';

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
    const candidate = mod?.default ?? mod;
    return typeof candidate === 'function' ? candidate : null;
  };

  try {
    const { createRequire } = await import('node:module');
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

export const isAiConfigured = plugins.length > 0;

if (!isAiConfigured) {
  const reason = !openAiPluginFactory
    ? `Das optionale Paket "${moduleSpecifier}" konnte nicht geladen werden.`
    : 'Es ist kein OPENAI_API_KEY gesetzt.';
  const extra = openAiLoadError instanceof Error ? ` (${openAiLoadError.message})` : '';
  console.warn(
    `[genkit] OpenAI-Plugin ist nicht konfiguriert: ${reason}${extra}.` +
      ' Die KI-Funktionen liefern dann einen Hinweis für fehlende Konfiguration.',
  );
}

export const ai = genkit({
  plugins,
  model: isAiConfigured ? 'openai/gpt-5' : undefined,
});

export const missingAiMessage =
  'The AI backend is not configured. Please install @genkit-ai/compat-oai and set OPENAI_API_KEY to enable AI responses.';
