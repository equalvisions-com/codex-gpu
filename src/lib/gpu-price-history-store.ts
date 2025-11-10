import { db } from "@/db/client";
import { gpuPriceSamples } from "@/db/schema";
import { lte, sql } from "drizzle-orm";

export interface GpuPriceSampleInput {
  stableKey: string;
  provider: string;
  observedAt: Date;
  priceUsd: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

class GpuPriceHistoryStore {
  async appendSamples(samples: GpuPriceSampleInput[]): Promise<string[]> {
    if (!samples.length) {
      return [];
    }

    const touched = new Set<string>();
    const values = samples.map((sample) => {
      touched.add(sample.stableKey);
      return {
        stableKey: sample.stableKey,
        provider: sample.provider,
        observedAt: sample.observedAt,
        priceUsd: sample.priceUsd,
        scrapedAt: new Date(),
      };
    });

    await db
      .insert(gpuPriceSamples)
      .values(values)
      .onConflictDoUpdate({
        target: [gpuPriceSamples.stableKey, gpuPriceSamples.observedAt],
        set: { priceUsd: sql`excluded.price_usd`, scrapedAt: sql`excluded.scraped_at` },
      });

    return Array.from(touched);
  }

  async pruneOlderThan(days: number): Promise<number> {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deleted = await db
      .delete(gpuPriceSamples)
      .where(lte(gpuPriceSamples.observedAt, threshold))
      .returning({ stableKey: gpuPriceSamples.stableKey });
    return deleted.length;
  }

  async pruneThirtyDaysWindow(): Promise<number> {
    const threshold = new Date(Date.now() - THIRTY_DAYS_MS);
    const deleted = await db
      .delete(gpuPriceSamples)
      .where(lte(gpuPriceSamples.observedAt, threshold))
      .returning({ stableKey: gpuPriceSamples.stableKey });
    return deleted.length;
  }
}

export const gpuPriceHistoryStore = new GpuPriceHistoryStore();
