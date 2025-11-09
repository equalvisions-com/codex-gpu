import { db } from "@/db/client";
import { aiModels } from "@/db/schema";
import { sql } from "drizzle-orm";
import { modelLatencyCache, type LatencySampleInput } from "@/lib/models-latency-cache";

interface LatencyApiEntry {
  x?: string;
  y?: Record<string, number | string | null>;
}

interface LatencyApiResponse {
  data?: LatencyApiEntry[];
}

export interface LatencyScrapeResult {
  permaslugsRequested: number;
  permaslugsProcessed: number;
  permaslugsFailed: number;
  samplesStored: number;
  clearedSamples: number;
  touchedPermaslugs: string[];
  errors: { permaslug: string; message: string }[];
}

const USER_AGENT = "Mozilla/5.0 (compatible; ModelsLatencyScraper/1.0)";

export class ModelsLatencyScraper {
  private readonly baseUrl = "https://openrouter.ai/api/frontend/stats/latency-comparison";

  private parseTimestamp(value?: string): Date | null {
    if (!value || typeof value !== "string") return null;
    const normalized = value.endsWith("Z") ? value : `${value}Z`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private async fetchPermaslug(permaslug: string): Promise<LatencySampleInput[]> {
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

    const parsed = (await response.json()) as LatencyApiResponse;
    const records = Array.isArray(parsed.data) ? parsed.data : [];
    const samples: LatencySampleInput[] = [];

    for (const entry of records) {
      const observedAt = this.parseTimestamp(entry?.x);
      if (!observedAt || !entry?.y) continue;

      for (const [endpointId, rawValue] of Object.entries(entry.y)) {
        if (!endpointId) continue;
        const latency = typeof rawValue === "number" ? rawValue : Number(rawValue);
        if (!Number.isFinite(latency)) continue;

        samples.push({
          permaslug,
          endpointId,
          observedAt,
          latency,
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

    return Array.from(
      new Set(
        rows
          .map((row) => row.permaslug)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );
  }

  async scrapeAll(limit?: number): Promise<LatencyScrapeResult> {
    const permaslugs = await this.getUniquePermaslugs();
    const pending = typeof limit === "number" ? permaslugs.slice(0, Math.max(limit, 0)) : permaslugs;

    const clearedSamples = await modelLatencyCache.clearAll();
    const touchedPermaslugs = new Set<string>();

    const stats: LatencyScrapeResult = {
      permaslugsRequested: pending.length,
      permaslugsProcessed: 0,
      permaslugsFailed: 0,
      samplesStored: 0,
      clearedSamples,
      touchedPermaslugs: [],
      errors: [],
    };

    const concurrency = 5;
    for (let i = 0; i < pending.length; i += concurrency) {
      const chunk = pending.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        chunk.map(async (permaslug) => {
          const samples = await this.fetchPermaslug(permaslug);
          if (!samples.length) return { permaslug, stored: 0 };
          const stored = await modelLatencyCache.upsertSamples(samples);
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
    return stats;
  }

  async scrapePermaslug(permaslug: string): Promise<number> {
    if (!permaslug) return 0;
    const samples = await this.fetchPermaslug(permaslug);
    if (!samples.length) return 0;
    return modelLatencyCache.upsertSamples(samples);
  }
}

export const modelsLatencyScraper = new ModelsLatencyScraper();
