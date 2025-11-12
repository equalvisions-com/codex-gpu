import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, unstable_cache } from "next/cache";
import { modelThroughputCache } from "@/lib/models-throughput-cache";
import { modelsThroughputScraper } from "@/lib/providers/models-throughput-scraper";

export const dynamic = "force-dynamic";

const getCachedThroughput = (permaslug: string) => {
  return unstable_cache(
    async () => {
      return modelThroughputCache.getSeriesGrouped(permaslug);
    },
    ["model-throughput", permaslug],
    {
      revalidate: 900,
      tags: [`model-throughput:${permaslug}`],
    },
  )();
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const permaslug = searchParams.get("permaslug");
  const endpointId = searchParams.get("endpointId") ?? undefined;
  const refresh = searchParams.get("refresh") === "1";

  if (!permaslug) {
    return NextResponse.json({ error: "permaslug is required" }, { status: 400 });
  }

  const cacheTag = `model-throughput:${permaslug}`;
  if (refresh) {
    await revalidateTag(cacheTag);
  }

  let series = await getCachedThroughput(permaslug);

  if ((!series || series.length === 0) && refresh) {
    await modelsThroughputScraper.scrapePermaslug(permaslug);
    await revalidateTag(cacheTag);
    series = await getCachedThroughput(permaslug);
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
