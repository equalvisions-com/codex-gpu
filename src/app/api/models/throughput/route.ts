import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { modelThroughputCache } from "@/lib/models-throughput-cache";

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

  if (!permaslug) {
    return NextResponse.json({ error: "permaslug is required" }, { status: 400 });
  }

  const cacheTag = `model-throughput:${permaslug}`;
  let series = await getCachedThroughput(permaslug);

  const filtered = endpointId
    ? series.filter((group) => group.endpointId === endpointId)
    : series;

  return NextResponse.json({
    permaslug,
    endpointId: endpointId ?? null,
    series: filtered,
  });
}
