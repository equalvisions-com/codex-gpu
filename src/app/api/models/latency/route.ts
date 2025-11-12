import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, unstable_cache } from "next/cache";
import { modelLatencyCache } from "@/lib/models-latency-cache";
import { modelsLatencyScraper } from "@/lib/providers/models-latency-scraper";

export const dynamic = "force-dynamic";

const getCachedLatency = (permaslug: string) =>
  unstable_cache(
    async () => modelLatencyCache.getSeriesGrouped(permaslug),
    ["model-latency", permaslug],
    {
      revalidate: 900,
      tags: [`model-latency:${permaslug}`],
    },
  )();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const permaslug = searchParams.get("permaslug");
  const endpointId = searchParams.get("endpointId") ?? undefined;
  const refresh = searchParams.get("refresh") === "1";

  if (!permaslug) {
    return NextResponse.json({ error: "permaslug is required" }, { status: 400 });
  }

  const cacheTag = `model-latency:${permaslug}`;
  if (refresh) {
    await revalidateTag(cacheTag);
  }

  let series = await getCachedLatency(permaslug);

  if ((!series || series.length === 0) && refresh) {
    await modelsLatencyScraper.scrapePermaslug(permaslug);
    await revalidateTag(cacheTag);
    series = await getCachedLatency(permaslug);
  }

  const filtered = endpointId
    ? series.filter((group) => group.endpointId === endpointId)
    : series;

  return NextResponse.json({
    permaslug,
    endpointId: endpointId ?? null,
    series: filtered,
  });
}
