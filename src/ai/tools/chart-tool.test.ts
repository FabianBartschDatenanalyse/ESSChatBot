import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/src/ai/genkit', () => ({
  ai: {
    defineTool: (_config: any, handler: any) => handler,
    generate: vi.fn(),
  },
  isAiConfigured: true,
  missingAiMessage: 'AI missing',
}));

let renderVegaLiteToPngDataUrl: typeof import('./chart-tool')['renderVegaLiteToPngDataUrl'];

beforeAll(async () => {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'test-api-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'anon-key';

  ({ renderVegaLiteToPngDataUrl } = await import('./chart-tool'));
});

const simpleSpec = {
  width: 200,
  height: 200,
  data: {
    values: [
      { category: 'A', value: 1 },
      { category: 'B', value: 2 },
    ],
  },
  mark: 'bar',
  encoding: {
    x: { field: 'category', type: 'nominal' },
    y: { field: 'value', type: 'quantitative' },
  },
};

describe('renderVegaLiteToPngDataUrl', () => {
  it('returns a PNG data URL for a minimal spec', async () => {
    const dataUrl = await renderVegaLiteToPngDataUrl(simpleSpec);

    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(1000);
  });
});
