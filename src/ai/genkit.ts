import { genkit } from 'genkit';
import { createRequire } from 'module';

const moduleSpecifier = '@genkit-ai/compat-oai/openai';

let openAiPluginFactory: ((options: { apiKey: string }) => any) | null = null;
let openAiLoadError: unknown;

try {
  const require = createRequire(import.meta.url);
  const mod = require(moduleSpecifier);
  openAiPluginFactory = mod?.default ?? mod ?? null;
} catch (error) {
  if ((error as NodeJS.ErrnoException | undefined)?.code === 'ERR_REQUIRE_ESM') {
    try {
      const mod = await import(moduleSpecifier);
      openAiPluginFactory = (mod as any)?.default ?? mod ?? null;
      openAiLoadError = undefined;
    } catch (importError) {
      openAiLoadError = importError;
    }
  } else {
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
