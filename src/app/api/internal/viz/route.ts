import { NextRequest, NextResponse } from 'next/server';
import {
  VisualizationRequestSchema,
  VisualizationResponseSchema,
} from '@/src/features/charting/types';
import { generateVisualization } from '@/src/features/charting/server/generate-visualization';

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);

  const parseResult = VisualizationRequestSchema.safeParse(payload);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        status: 'error',
        error: {
          message: 'Ungültige Anfrage für die Visualisierung.',
          details: parseResult.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const visualization = await generateVisualization(parseResult.data);

  const responseValidation = VisualizationResponseSchema.safeParse(visualization);

  if (!responseValidation.success) {
    return NextResponse.json(
      {
        status: 'error',
        error: {
          message: 'Die Visualisierung konnte nicht validiert werden.',
          details: responseValidation.error.flatten(),
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json(responseValidation.data, {
    status: visualization.status === 'success' ? 200 : 500,
  });
}

