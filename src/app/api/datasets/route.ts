import { NextResponse } from 'next/server';
import {
  listDatasetSummaries,
  createDatasetFromUpload,
} from '@/src/features/datasets/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const datasets = await listDatasetSummaries();
    return NextResponse.json({ datasets }, { status: 200 });
  } catch (error) {
    console.error('[datasets GET] Failed to list datasets:', error);
    return NextResponse.json({ error: 'Failed to list datasets.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const titleValue = formData.get('title');
    const metadataValue = formData.get('metadata');
    const autoMetadataValue = formData.get('autoMetadata');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing dataset file.' }, { status: 400 });
    }

    const title = typeof titleValue === 'string' ? titleValue : undefined;
    const metadataFile = metadataValue instanceof File ? metadataValue : undefined;
    const autoGenerateMetadata =
      typeof autoMetadataValue === 'string' && autoMetadataValue.toLowerCase() === 'true';
    const dataset = await createDatasetFromUpload({
      file,
      title,
      metadataFile,
      autoGenerateMetadata,
    });
    return NextResponse.json(dataset, { status: 201 });
  } catch (error: any) {
    console.error('[datasets POST] Failed to upload dataset:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload dataset.',
        details: error?.message,
      },
      { status: 500 },
    );
  }
}
