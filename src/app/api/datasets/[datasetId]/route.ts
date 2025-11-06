import { NextResponse } from 'next/server';
import {
  getDatasetMetadata,
  updateDatasetMetadata,
  removeDataset,
} from '@/src/features/datasets/server';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function GET(_: Request, context: RouteParams) {
  try {
    const { datasetId } = await context.params;
    const dataset = await getDatasetMetadata(datasetId);
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 });
    }
    return NextResponse.json(dataset, { status: 200 });
  } catch (error) {
    console.error('[datasets/:id GET] Failed:', error);
    return NextResponse.json({ error: 'Failed to fetch dataset.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteParams) {
  try {
    const { datasetId } = await context.params;
    const payload = await request.json();
    const updated = await updateDatasetMetadata({ datasetId, payload });
    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error('[datasets/:id PATCH] Failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to update dataset metadata.',
        details: error?.message,
      },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, context: RouteParams) {
  try {
    const { datasetId } = await context.params;
    await removeDataset(datasetId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[datasets/:id DELETE] Failed:', error);
    return NextResponse.json({ error: 'Failed to delete dataset.' }, { status: 500 });
  }
}
