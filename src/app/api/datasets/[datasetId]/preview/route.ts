import { NextResponse } from 'next/server';
import { getDatasetPreview } from '@/src/features/datasets/server';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function GET(_: Request, context: RouteParams) {
  try {
    const { datasetId } = await context.params;
    const preview = await getDatasetPreview(datasetId);
    if (!preview) {
      return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 });
    }
    return NextResponse.json({ preview }, { status: 200 });
  } catch (error) {
    console.error('[datasets/:id/preview GET] Failed:', error);
    return NextResponse.json({ error: 'Failed to fetch dataset preview.' }, { status: 500 });
  }
}

