import { genkit } from 'genkit';

const moduleSpecifier = '@genkit-ai/compat-oai/openai';

const dynamicRequire: NodeJS.Require | undefined = (() => {
  try {
    return Function("return typeof require !== 'undefined' ? require : undefined;")();
  } catch {
    return undefined;
  }
})();

let openAiPluginFactory: ((options: { apiKey: string }) => any) | null = null;
let openAiLoadError: unknown;

if (dynamicRequire) {
  try {
    const mod = dynamicRequire(moduleSpecifier);
    openAiPluginFactory = mod?.default ?? mod ?? null;
  } catch (error) {
    openAiLoadError = error;
  }
}

const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
const plugins = openAiPluginFactory && hasApiKey ? [openAiPluginFactory({ apiKey: process.env.OPENAI_API_KEY! })] : [];

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
