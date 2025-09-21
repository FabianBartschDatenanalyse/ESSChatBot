import { NextResponse } from 'next/server';
import { MainAssistantInputSchema, mainAssistant } from '@/src/ai/flows/main-assistant-flow';

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = MainAssistantInputSchema.safeParse(json);

    if (!parsed.success) {
      console.error('[main-assistant API] Invalid request payload:', parsed.error.flatten());
      return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }

    const result = await mainAssistant(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[main-assistant API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
