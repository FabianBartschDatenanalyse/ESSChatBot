import { create } from 'zustand';
import { VisualizationChart } from '@/src/features/charting/types';

export type ChartStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ChartEntry {
  status: ChartStatus;
  chart?: VisualizationChart;
  error?: string;
}

interface ChartStoreState {
  items: Record<string, ChartEntry>;
  setLoading: (id: string) => void;
  setSuccess: (id: string, chart: VisualizationChart) => void;
  setError: (id: string, error: string) => void;
  updateChartConfig: (id: string, config: VisualizationChart['config']) => void;
  reset: (id?: string) => void;
}

export const useChartStore = create<ChartStoreState>((set) => ({
  items: {},
  setLoading: (id) =>
    set((state) => ({
      items: {
        ...state.items,
        [id]: {
          status: 'loading',
          chart: state.items[id]?.chart,
        },
      },
    })),
  setSuccess: (id, chart) =>
    set((state) => ({
      items: {
        ...state.items,
        [id]: {
          status: 'success',
          chart,
        },
      },
    })),
  setError: (id, error) =>
    set((state) => ({
      items: {
        ...state.items,
        [id]: {
          status: 'error',
          error,
        },
      },
    })),
  updateChartConfig: (id, config) =>
    set((state) => {
      const entry = state.items[id];
      if (!entry?.chart) {
        return state;
      }

      return {
        items: {
          ...state.items,
          [id]: {
            ...entry,
            chart: {
              ...entry.chart,
              config,
            },
          },
        },
      };
    }),
  reset: (id) =>
    set((state) => {
      if (!id) {
        return { items: {} };
      }

      const next = { ...state.items };
      delete next[id];
      return { items: next };
    }),
}));

