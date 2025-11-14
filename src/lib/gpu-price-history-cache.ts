import { db } from "@/db/client";
import { gpuPriceSamples } from "@/db/schema";
import { and, gte, eq, asc } from "drizzle-orm";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface GpuPriceHistoryPoint {
  observedAt: string;
  priceUsd: number;
}

class GpuPriceHistoryCache {
  async getSeries(stableKey: string): Promise<GpuPriceHistoryPoint[]> {
    if (!stableKey) {
      return [];
    }

    const threshold = new Date(Date.now() - THIRTY_DAYS_MS);

    const rows = await db
      .select({
        observedAt: gpuPriceSamples.observedAt,
        priceUsd: gpuPriceSamples.priceUsd,
      })
      .from(gpuPriceSamples)
      .where(
        and(
          eq(gpuPriceSamples.stableKey, stableKey),
          gte(gpuPriceSamples.observedAt, threshold),
        ),
      )
      .orderBy(asc(gpuPriceSamples.observedAt));

    return rows.map((row) => ({
      observedAt: row.observedAt.toISOString(),
      priceUsd: Number(row.priceUsd ?? 0),
    }));
  }
}

export const gpuPriceHistoryCache = new GpuPriceHistoryCache();
