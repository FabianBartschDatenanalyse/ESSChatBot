import {
  VisualizationRequest,
  VisualizationResponse,
  VisualizationResponseSchema,
} from '@/src/features/charting/types';

interface FetchChartOptions {
  signal?: AbortSignal;
}

export async function fetchChart(
  request: VisualizationRequest,
  options?: FetchChartOptions,
): Promise<VisualizationResponse> {
  const response = await fetch('/api/internal/viz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: options?.signal,
  });

  const json = await response.json().catch(() => null);

  const parsed = VisualizationResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error('Die Visualisierung konnte nicht geladen werden.');
  }

  if (!response.ok || parsed.data.status === 'error') {
    const message = parsed.data.error?.message ?? 'Die Visualisierung schlug fehl.';
    throw new Error(message);
  }

  return parsed.data;
}

