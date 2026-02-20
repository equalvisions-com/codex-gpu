import { NextRequest, NextResponse } from "next/server";
import { modelsCache } from "@/lib/models-cache";
import { readLimiter, getReadRateLimitKey } from "@/lib/redis/ratelimit";
import { logger } from "@/lib/logger";

function buildRateHeaders(limit?: number, remaining?: number, reset?: number) {
  const headers: Record<string, string> = {};
  if (typeof limit === "number") headers["X-RateLimit-Limit"] = String(limit);
  if (typeof remaining === "number") headers["X-RateLimit-Remaining"] = String(remaining);
  if (typeof reset === "number") headers["X-RateLimit-Reset"] = String(reset);
  return headers;
}

// GET /api/models/[provider] - Returns models for a specific provider
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    const rate = await readLimiter.limit(getReadRateLimitKey(ip));
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: buildRateHeaders(rate.limit, rate.remaining, rate.reset) }
      );
    }

    const { provider } = await params;

    if (!provider) {
      return NextResponse.json({
        error: "Provider parameter is required",
      }, { status: 400 });
    }

    const models = await modelsCache.getModelsByProvider(provider);

    if (models.length === 0) {
      return NextResponse.json({
        error: `No models found for provider: ${provider}`,
      }, { status: 404 });
    }

    return NextResponse.json(models);

  } catch (error) {
    const resolvedParams = await params;
    logger.error(`Failed to fetch models for provider ${resolvedParams.provider}:`, error);

    return NextResponse.json({
      error: "Failed to fetch models data",
    }, { status: 500 });
  }
}
