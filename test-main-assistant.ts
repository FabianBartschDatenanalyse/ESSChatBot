import 'dotenv/config';

import { mainAssistant } from './src/ai/flows/main-assistant-flow';

async function test() {
  const input = {
    question: 'What is the average trust in parliament per country?',
    history: [],
  };

  const result = await mainAssistant(input);
  console.log('[TEST] Result:', JSON.stringify(result, null, 2));
}

test().catch(err => {
  console.error('[TEST] Error:', err);
});
