import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { gpuPriceHistoryCache } from "@/lib/gpu-price-history-cache";
import { STANDARD_CACHE_TTL } from "@/lib/cache/constants";

const getCachedHistory = (stableKey: string) =>
  unstable_cache(
    async () => gpuPriceHistoryCache.getSeries(stableKey),
    ["gpu-price-history", stableKey],
    {
      revalidate: STANDARD_CACHE_TTL,
      tags: [`gpu-price-history:${stableKey}`],
    },
  )();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stableKey = searchParams.get("stableKey") ?? searchParams.get("stable_key");

  if (!stableKey) {
    return NextResponse.json({ error: "stableKey is required" }, { status: 400 });
  }

  const series = await getCachedHistory(stableKey);

  return NextResponse.json({
    stableKey,
    series,
  });
}
