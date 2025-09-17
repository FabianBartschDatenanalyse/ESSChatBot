// scripts/smoke-test.ts
import 'dotenv/config';
import { ai } from '@/src/ai/genkit';

async function main() {
  try {
    const res = await ai.generate({
      model: 'openai/gpt-5',
      prompt: 'Say hello in one short sentence.',
    });

    console.log('✅ GPT-5 responded:', res.text);
  } catch (err) {
    console.error('❌ Smoke test failed:', err);
    process.exit(1);
  }
}

main();
