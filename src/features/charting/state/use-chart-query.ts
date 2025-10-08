import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchChart } from '@/src/features/charting/api/fetch-chart';
import {
  VisualizationChart,
  VisualizationResponse,
  VisualizationRequest,
} from '@/src/features/charting/types';
import { useChartStore } from '@/src/features/charting/state/chart-store';

interface UseChartQueryParams {
  chartId: string;
  request: VisualizationRequest;
  initialChart?: VisualizationChart;
  enabled?: boolean;
}

export function useChartQuery({
  chartId,
  request,
  initialChart,
  enabled = true,
}: UseChartQueryParams) {
  const setLoading = useChartStore((state) => state.setLoading);
  const setSuccess = useChartStore((state) => state.setSuccess);
  const setError = useChartStore((state) => state.setError);

  const query = useQuery<VisualizationResponse, Error>({
    queryKey: ['chart', chartId],
    queryFn: ({ signal }) => fetchChart({ ...request, clientChartId: chartId }, { signal }),
    staleTime: 60_000,
    retry: 1,
    enabled,
    initialData: initialChart
      ? {
          status: 'success',
          chart: { ...initialChart, id: chartId },
          meta: {
            generatedAt: new Date().toISOString(),
            request: { ...request, clientChartId: chartId },
          },
        }
      : undefined,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (query.isFetching) {
      setLoading(chartId);
    }
  }, [chartId, enabled, query.isFetching, setLoading]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (query.data?.status === 'success' && query.data.chart) {
      setSuccess(chartId, { ...query.data.chart, id: chartId });
    }

    if (query.isError) {
      setError(chartId, query.error.message);
    } else if (query.data?.status === 'error' && query.data.error) {
      setError(chartId, query.data.error.message);
    }
  }, [chartId, enabled, query.data, query.error, query.isError, setError, setSuccess]);

  return query;
}

