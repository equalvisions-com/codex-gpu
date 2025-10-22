import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { logger } from "@/lib/logger";
import { gpuPricingScraper } from "@/lib/providers/gpu-pricing-scraper";
import { gpuPricingStore } from "@/lib/gpu-pricing-store";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Allow up to 30 seconds for scraping

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerParam = searchParams.get("provider");
    const force = searchParams.get("force") === "1";

    if (providerParam && providerParam !== "all") {
      return NextResponse.json(
        {
          success: false,
          error: "Partial provider scrapes are no longer supported. Use provider=all or omit the parameter.",
        },
        { status: 400 },
      );
    }

    const startTime = Date.now();
    logger.info("[GpuPricingJob] Starting full GPU pricing scrape...");

    const scrapeResult = await gpuPricingScraper.scrapeAll();
    const stored = await gpuPricingStore.replaceAll(scrapeResult.providerResults);

    revalidateTag("pricing");
    revalidatePath("/api");
    // `/api` already covers the main GPU data endpoint

    const duration = Date.now() - startTime;
    const totalRows = scrapeResult.providerResults.reduce((acc, result) => acc + result.rows.length, 0);

    logger.info(`[GpuPricingJob] Scrape completed in ${duration}ms. Stored ${stored} rows.`);

    return NextResponse.json({
      success: true,
      force,
      duration,
      stored,
      rowsScraped: totalRows,
      scrapedAt: scrapeResult.scrapedAt,
      sourceHash: scrapeResult.sourceHash,
      summaries: scrapeResult.summaries,
    });
  } catch (error) {
    console.error("Scraping job failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}

// GET /api/jobs/scrape - Get cache stats or trigger scraping
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const run = searchParams.get("run") === "1";
    const providerParam = searchParams.get("provider");
    const force = searchParams.get("force") === "1";

    if (providerParam && providerParam !== "all") {
      return NextResponse.json(
        {
          success: false,
          error: "Partial provider scrapes are no longer supported. Use provider=all or omit the parameter.",
        },
        { status: 400 },
      );
    }

    if (run) {
      const startedAt = Date.now();
      logger.info("[GpuPricingJob][cron] Starting scheduled GPU pricing scrape...");

      const scrapeResult = await gpuPricingScraper.scrapeAll();
      const stored = await gpuPricingStore.replaceAll(scrapeResult.providerResults);

      revalidateTag("pricing");
      revalidatePath("/api");
      // `/api` already covers the main GPU data endpoint

      const duration = Date.now() - startedAt;
      const totalRows = scrapeResult.providerResults.reduce((acc, result) => acc + result.rows.length, 0);

      logger.info(`[GpuPricingJob][cron] Scrape completed in ${duration}ms. Stored ${stored} rows.`);

      return NextResponse.json({
        success: true,
        force,
        duration,
        stored,
        rowsScraped: totalRows,
        scrapedAt: scrapeResult.scrapedAt,
        sourceHash: scrapeResult.sourceHash,
        summaries: scrapeResult.summaries,
      });
    }

    const stats = await gpuPricingStore.getCacheStats();
    return NextResponse.json({
      status: "operational",
      totalRows: stats.totalRows,
      providers: stats.providers,
      lastScrapedAt: stats.lastScrapedAt,
    });
  } catch (error) {
    console.error("Cache stats / cron failed:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Periodic maintenance endpoint (e.g., cron ping)
export async function PUT(_request: NextRequest) {
  try {
    return NextResponse.json({ ok: true, removed: 0 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
