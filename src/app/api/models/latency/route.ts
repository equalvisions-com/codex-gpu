import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { modelLatencyCache } from "@/lib/models-latency-cache";

export const revalidate = 43200;

const getCachedLatency = (permaslug: string) =>
  unstable_cache(
    async () => modelLatencyCache.getSeriesGrouped(permaslug),
    ["model-latency", permaslug],
    {
      revalidate: 43200,
      tags: [`model-latency:${permaslug}`],
    },
  )();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const permaslug = searchParams.get("permaslug");
  const endpointId = searchParams.get("endpointId") ?? undefined;

  if (!permaslug) {
    return NextResponse.json({ error: "permaslug is required" }, { status: 400 });
  }

  const cacheTag = `model-latency:${permaslug}`;
  let series = await getCachedLatency(permaslug);

  const filtered = endpointId
    ? series.filter((group) => group.endpointId === endpointId)
    : series;

  return NextResponse.json({
    permaslug,
    endpointId: endpointId ?? null,
    series: filtered,
  });
}
