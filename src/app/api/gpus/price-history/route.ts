import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, unstable_cache } from "next/cache";
import { gpuPriceHistoryCache } from "@/lib/gpu-price-history-cache";

export const dynamic = "force-dynamic";

const getCachedHistory = (stableKey: string) =>
  unstable_cache(
    async () => gpuPriceHistoryCache.getSeries(stableKey),
    ["gpu-price-history", stableKey],
    {
      revalidate: 900,
      tags: [`gpu-price-history:${stableKey}`],
    },
  )();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stableKey = searchParams.get("stableKey") ?? searchParams.get("stable_key");
  const refresh = searchParams.get("refresh") === "1";

  if (!stableKey) {
    return NextResponse.json({ error: "stableKey is required" }, { status: 400 });
  }

  if (refresh) {
    await revalidateTag(`gpu-price-history:${stableKey}`);
  }

  const series = await getCachedHistory(stableKey);

  return NextResponse.json({
    stableKey,
    series,
  });
}
