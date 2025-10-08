import { useEffect, useMemo, useState } from 'react';
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

interface QueryState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: VisualizationResponse;
  error: Error | null;
  isFetching: boolean;
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

  const initialData = useMemo<VisualizationResponse | undefined>(() => {
    if (!initialChart) {
      return undefined;
    }

    return {
      status: 'success',
      chart: { ...initialChart, id: chartId },
      meta: {
        generatedAt: new Date().toISOString(),
        request: { ...request, clientChartId: chartId },
      },
    };
  }, [chartId, initialChart, request]);

  const [state, setState] = useState<QueryState>(() => ({
    status: initialData ? 'success' : enabled ? 'loading' : 'idle',
    data: initialData,
    error: null,
    isFetching: false,
  }));

  useEffect(() => {
    if (!initialData) {
      return;
    }

    setState((prev) => {
      if (prev.data?.chart.id === initialData.chart.id) {
        return prev;
      }

      return {
        status: 'success',
        data: initialData,
        error: null,
        isFetching: prev.isFetching,
      };
    });
  }, [initialData]);

  useEffect(() => {
    if (!enabled || !chartId) {
      setState((prev) => ({
        ...prev,
        isFetching: false,
        status: prev.data ? 'success' : 'idle',
      }));
      return;
    }

    let isActive = true;
    const controller = new AbortController();

    setState((prev) => ({
      ...prev,
      status: prev.data ? 'success' : 'loading',
      isFetching: true,
      error: null,
    }));

    fetchChart({ ...request, clientChartId: chartId }, { signal: controller.signal })
      .then((response) => {
        if (!isActive) {
          return;
        }

        setState({
          status: 'success',
          data: response,
          error: null,
          isFetching: false,
        });
      })
      .catch((error) => {
        if (!isActive || error?.name === 'AbortError') {
          return;
        }

        const normalizedError =
          error instanceof Error ? error : new Error('Die Visualisierung konnte nicht geladen werden.');

        setState((prev) => ({
          status: 'error',
          data: prev.data,
          error: normalizedError,
          isFetching: false,
        }));
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [chartId, enabled, request]);

  const query = useMemo(
    () => ({
      data: state.data,
      error: state.error ?? undefined,
      isError: state.status === 'error',
      isLoading: state.status === 'loading' && !state.data,
      isFetching: state.isFetching,
    }),
    [state],
  );

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

