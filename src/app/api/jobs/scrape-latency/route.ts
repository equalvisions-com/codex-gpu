import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { modelsLatencyScraper } from "@/lib/providers/models-latency-scraper";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const CORE_PAGE_PATHS = ["/", "/gpus", "/llms", "/tools"];

async function revalidateCorePages() {
  await Promise.all(CORE_PAGE_PATHS.map((path) => revalidatePath(path)));
}

export async function POST(request: NextRequest) {
  try {
    const start = Date.now();
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const result = await modelsLatencyScraper.scrapeAll(limit);

    if (result.touchedPermaslugs.length > 0) {
      await Promise.all(
        result.touchedPermaslugs.map((permaslug) =>
          revalidateTag(`model-latency:${permaslug}`),
        ),
      );
    }
    await revalidateCorePages();

    const duration = Date.now() - start;
    logger.info(
      JSON.stringify({
        event: "jobs.scrape-latency.completed",
        permaslugsRequested: result.permaslugsRequested,
        permaslugsProcessed: result.permaslugsProcessed,
        permaslugsFailed: result.permaslugsFailed,
        samplesStored: result.samplesStored,
        clearedSamples: result.clearedSamples,
        duration,
        pagesRevalidated: CORE_PAGE_PATHS,
      }),
    );

    return NextResponse.json({
      success: true,
      duration,
      ...result,
    });
  } catch (error) {
    logger.error(
      JSON.stringify({
        event: "jobs.scrape-latency.failed",
        error: error instanceof Error ? error.message : "unknown",
      }),
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to scrape latency",
      },
      { status: 500 },
    );
  }
}
