import {genkit, GenerationCommonConfig} from 'genkit';
import {openai} from 'genkitx-openai';

const gpt4oConfig: GenerationCommonConfig = {
  temperature: 0.2, // Lower temperature for more predictable, factual responses
};

export const ai = genkit({
  plugins: [
    openai({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  ],
  model: 'openai/gpt-4o',
  // Apply the config to all models, you can also apply it per-generation
  // modelConfig: gpt4oConfig,
});
