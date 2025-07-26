'use server';

import {runLinearRegression} from '@/lib/stats-service';
import {NextResponse} from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {target, features, filters} = body;

    if (!target || !features) {
      return NextResponse.json(
        {error: "Missing 'target' or 'features' parameter"},
        {status: 400}
      );
    }

    const result = await runLinearRegression(target, features, filters);

    if (result.error) {
      return NextResponse.json(result, {status: 500});
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      {error: `An unexpected error occurred: ${e.message}`},
      {status: 500}
    );
  }
}
