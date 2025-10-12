import { NextRequest, NextResponse } from 'next/server';
import { modelsCache } from '@/lib/models-cache';

export const dynamic = 'force-dynamic';

// GET /api/models/[provider] - Returns models for a specific provider
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await params;

    if (!provider) {
      return NextResponse.json({
        error: 'Provider parameter is required',
      }, { status: 400 });
    }

    const models = await modelsCache.getModelsByProvider(provider);

    if (models.length === 0) {
      return NextResponse.json({
        error: `No models found for provider: ${provider}`,
      }, { status: 404 });
    }

    // Set cache headers for Edge caching (provider-level data)
    const response = NextResponse.json(models, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });

    return response;

  } catch (error) {
    const resolvedParams = await params;
    console.error(`Failed to fetch models for provider ${resolvedParams.provider}:`, error);

    return NextResponse.json({
      error: 'Failed to fetch models data',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
