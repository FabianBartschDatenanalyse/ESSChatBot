import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/src/ai/genkit', () => ({
  ai: {
    defineTool: (_config: any, handler: any) => handler,
    generate: vi.fn(),
  },
}));

let renderVegaLiteToPngDataUrl: typeof import('./chart-tool')['renderVegaLiteToPngDataUrl'];
let buildBarChartEntries: typeof import('./chart-tool')['buildBarChartEntries'];

beforeAll(async () => {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'test-api-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'anon-key';

  ({ renderVegaLiteToPngDataUrl, buildBarChartEntries } = await import('./chart-tool'));
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

describe('buildBarChartEntries', () => {
  it('keeps labels aligned with categorical sort order', () => {
    const encoding = {
      x: { field: 'category', type: 'nominal', sort: '-y' },
      y: { field: 'value', type: 'quantitative' },
    };
    const values = [
      { category: 'Alpha', value: 2 },
      { category: 'Gamma', value: 1 },
      { category: 'Beta', value: 5 },
    ];

    const entries = buildBarChartEntries(values, encoding, 'vertical');

    expect(entries.map((entry) => entry.value)).toEqual([5, 2, 1]);
    expect(entries.map((entry) => entry.label)).toEqual(['BETA', 'ALPHA', 'GAMMA']);
  });
});
