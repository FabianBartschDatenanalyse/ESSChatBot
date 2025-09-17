import { genkit } from 'genkit';
import openAI from '@genkit-ai/compat-oai/openai';

export const ai = genkit({
  plugins: [
    openAI({
      apiKey: process.env.OPENAI_API_KEY!, // sicherstellen, dass .env gesetzt ist
    }),
  ],
  // Optional: Default-Modell setzen
  model: 'openai/gpt-5',
});
