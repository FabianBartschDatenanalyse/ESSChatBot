import { chartTool } from '@/src/ai/tools/chart-tool';
import { isAiConfigured, missingAiMessage } from '@/src/ai/genkit';
import { VisualizationRequest, VisualizationResponse } from '@/src/features/charting/types';
import { randomUUID } from 'crypto';

async function validateVegaLiteSpec(spec: any): Promise<void> {
  if (!spec) return;
  const [vegaLiteModule, vegaModule] = await Promise.all([
    import('vega-lite'),
    import('vega'),
  ]);

  const vegaLite = (vegaLiteModule as any).default ?? vegaLiteModule;
  const vega = (vegaModule as any).default ?? vegaModule;

  const compiled = vegaLite.compile(spec).spec;
  vega.parse(compiled);
}

export async function generateVisualization(
  request: VisualizationRequest,
): Promise<VisualizationResponse> {
  if (!isAiConfigured) {
    return {
      status: 'error',
      error: {
        message: missingAiMessage,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        request,
      },
    };
  }

  try {
    const chart = await chartTool({
      nlQuestion: request.nlQuestion,
      history: request.history,
    });

    if (chart.error) {
      return {
        status: 'error',
        error: {
          message: chart.error,
        },
        meta: {
          generatedAt: new Date().toISOString(),
          request,
        },
      };
    }

    if (!chart.vegaLiteSpec) {
      return {
        status: 'error',
        error: {
          message: 'Das Chart-Tool lieferte keine Vega-Lite-Spezifikation zurück.',
        },
        meta: {
          generatedAt: new Date().toISOString(),
          request,
        },
      };
    }

    await validateVegaLiteSpec(chart.vegaLiteSpec);

    const chartId = request.clientChartId ?? randomUUID();

    return {
      status: 'success',
      chart: {
        id: chartId,
        config: chart.vegaLiteSpec,
        title: chart.title,
        caption: chart.caption,
        interpretation: chart.interpretation ?? undefined,
        imageDataUrl: chart.imageDataUrl ?? undefined,
        sqlQuery: chart.sqlQuery ?? undefined,
        retrievedContext: chart.retrievedContext ?? undefined,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        request: { ...request, clientChartId: chartId },
      },
    };
  } catch (error: any) {
    const message =
      typeof error?.message === 'string'
        ? error.message
        : 'Unbekannter Fehler beim Generieren der Visualisierung.';

    return {
      status: 'error',
      error: {
        message,
        details:
          error && typeof error === 'object' ? JSON.stringify(error, null, 2) : undefined,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        request,
      },
    };
  }
}

