import { NextResponse } from 'next/server';
import { mainAssistant } from '@/src/ai/flows/main-assistant-flow';

export const runtime = 'nodejs';

interface RequestPayload {
  question?: unknown;
  history?: unknown;
  datasetId?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestPayload;

    if (typeof body.question !== 'string' || body.question.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid "question" value.' }, { status: 400 });
    }

    if (typeof body.datasetId !== 'string' || body.datasetId.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid "datasetId" value.' }, { status: 400 });
    }

    const history =
      Array.isArray(body.history) && body.history.every(isValidHistoryMessage)
        ? body.history
        : undefined;

    const result = await mainAssistant({
      question: body.question,
      history,
      datasetId: body.datasetId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[main-assistant API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

type HistoryMessage = {
  role: 'user' | 'assistant' | 'tool';
  content: string;
};

function isValidHistoryMessage(value: unknown): value is HistoryMessage {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<HistoryMessage>;
  const validRoles = ['user', 'assistant', 'tool'] as const;

  return (
    typeof candidate.content === 'string' &&
    typeof candidate.role === 'string' &&
    (validRoles as readonly string[]).includes(candidate.role)
  );
}
