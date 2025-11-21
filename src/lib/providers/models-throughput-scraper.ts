import { db } from "@/db/client";
import { aiModels } from "@/db/schema";
import { sql } from "drizzle-orm";
import { modelThroughputCache, type ThroughputSampleInput } from "@/lib/models-throughput-cache";
import { normalizeObservedAtDate } from "@/lib/normalize-observed-at";

interface ThroughputApiEntry {
  x?: string;
  y?: Record<string, number | string | null>;
}

interface ThroughputApiResponse {
  data?: ThroughputApiEntry[];
}

interface ThroughputScrapeResult {
  permaslugsRequested: number;
  permaslugsProcessed: number;
  permaslugsFailed: number;
  samplesStored: number;
  clearedSamples: number;
  modelsReset: number;
  modelsUpdated: number;
  touchedPermaslugs: string[];
  errors: { permaslug: string; message: string }[];
}

const USER_AGENT = "Mozilla/5.0 (compatible; ModelsThroughputScraper/1.0)";

class ModelsThroughputScraper {
  private readonly baseUrl = "https://openrouter.ai/api/frontend/stats/throughput-comparison";

  private parseTimestamp(value?: string): Date | null {
    if (!value || typeof value !== "string") {
      return null;
    }

    const parsed = normalizeObservedAtDate(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private async fetchPermaslug(permaslug: string): Promise<ThroughputSampleInput[]> {
    const url = `${this.baseUrl}?permaslug=${encodeURIComponent(permaslug)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = (await response.json()) as ThroughputApiResponse;
    const entries = Array.isArray(body.data) ? body.data : [];
    const samples: ThroughputSampleInput[] = [];

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const observedAt = this.parseTimestamp(entry.x);
      if (!observedAt) continue;
      if (!entry.y || typeof entry.y !== "object") continue;

      for (const [endpointId, rawValue] of Object.entries(entry.y)) {
        if (typeof endpointId !== "string" || !endpointId) continue;
        const throughput = typeof rawValue === "number" ? rawValue : Number(rawValue);
        if (!Number.isFinite(throughput)) continue;

        samples.push({
          permaslug,
          endpointId,
          observedAt,
          throughput,
        });
      }
    }

    return samples;
  }

  private async getUniquePermaslugs(): Promise<string[]> {
    const rows = await db
      .select({ permaslug: aiModels.permaslug })
      .from(aiModels)
      .where(sql`${aiModels.permaslug} IS NOT NULL`);

    if (!rows.length) {
      return [];
    }

    const ordered = rows
      .map((row) => row.permaslug)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    return Array.from(new Set(ordered));
  }

  async scrapeAll(limit?: number): Promise<ThroughputScrapeResult> {
    const permaslugs = await this.getUniquePermaslugs();
    const pending = typeof limit === "number" ? permaslugs.slice(0, Math.max(limit, 0)) : permaslugs;

    const clearedSamples = await modelThroughputCache.clearAll();
    const modelsReset = await modelThroughputCache.resetModelThroughput();
    const touchedPermaslugs = new Set<string>();

    const stats: ThroughputScrapeResult = {
      permaslugsRequested: pending.length,
      permaslugsProcessed: 0,
      permaslugsFailed: 0,
      samplesStored: 0,
      clearedSamples,
      modelsReset,
      modelsUpdated: 0,
      touchedPermaslugs: [],
      errors: [],
    };

    const concurrency = 5;
    for (let i = 0; i < pending.length; i += concurrency) {
      const chunk = pending.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        chunk.map(async (permaslug) => {
          const samples = await this.fetchPermaslug(permaslug);
          if (!samples.length) {
            return { permaslug, stored: 0 };
          }
          const stored = await modelThroughputCache.upsertSamples(samples);
          return { permaslug, stored };
        }),
      );

      results.forEach((result, index) => {
        const permaslug = chunk[index];
        if (result.status === "fulfilled") {
          stats.permaslugsProcessed += 1;
          stats.samplesStored += result.value.stored;
          if (result.value.stored > 0) {
            touchedPermaslugs.add(permaslug);
          }
        } else {
          stats.permaslugsFailed += 1;
          stats.errors.push({
            permaslug: permaslug ?? "unknown",
            message:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason ?? "unknown error"),
          });
        }
      });
    }

    stats.touchedPermaslugs = Array.from(touchedPermaslugs);
    stats.modelsUpdated = await modelThroughputCache.syncLatestThroughputToModels();
    return stats;
  }

  async scrapePermaslug(permaslug: string): Promise<number> {
    if (!permaslug) return 0;
    const samples = await this.fetchPermaslug(permaslug);
    if (!samples.length) return 0;
    return modelThroughputCache.upsertSamples(samples);
  }
}

export const modelsThroughputScraper = new ModelsThroughputScraper();
