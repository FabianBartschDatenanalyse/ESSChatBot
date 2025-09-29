import { NextResponse } from 'next/server';
import { MainAssistantInputSchema, mainAssistant } from '@/src/ai/flows/main-assistant-flow';

function sanitizeForJson(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForJson(item, seen));
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return null;
    }

    if (!Number.isFinite(value)) {
      return value.toString();
    }

    return value;
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return null;
    }

    seen.add(value as object);

    if (value instanceof Map) {
      return Array.from(value.entries()).map(([key, entryValue]) => ({
        key,
        value: sanitizeForJson(entryValue, seen),
      }));
    }

    if (value instanceof Set) {
      return Array.from(value.values()).map((entryValue) => sanitizeForJson(entryValue, seen));
    }

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (acc, [key, entryValue]) => {
        const sanitizedValue = sanitizeForJson(entryValue, seen);
        if (sanitizedValue !== undefined) {
          acc[key] = sanitizedValue;
        }
        return acc;
      },
      {},
    );
  }

  if (typeof value === 'symbol' || typeof value === 'function') {
    return undefined;
  }

  return value;
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = MainAssistantInputSchema.safeParse(json);

    if (!parsed.success) {
      console.error('[main-assistant API] Invalid request payload:', parsed.error.flatten());
      return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
    }

    const result = await mainAssistant(parsed.data);
    const sanitizedResult = sanitizeForJson(result);
    return NextResponse.json(sanitizedResult);
  } catch (error) {
    console.error('[main-assistant API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
