import { db } from "@/db/client";
import { aiModels, modelLatencySamples } from "@/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

export interface LatencySampleInput {
  permaslug: string;
  endpointId: string;
  observedAt: Date;
  latency: number;
  scrapedAt?: Date;
}

interface LatencySeriesPoint {
  endpointId: string;
  observedAt: string;
  latency: number;
}

interface LatencySeriesGroup {
  endpointId: string;
  provider?: string | null;
  modelId?: string | null;
  slug?: string | null;
  shortName?: string | null;
  data: LatencySeriesPoint[];
}

class ModelLatencyCache {
  async upsertSamples(samples: LatencySampleInput[]): Promise<number> {
    if (!samples.length) {
      return 0;
    }

    const values = samples.map((sample) => ({
      permaslug: sample.permaslug,
      endpointId: sample.endpointId,
      observedAt: sample.observedAt,
      latency: sample.latency,
      scrapedAt: sample.scrapedAt ?? new Date(),
    }));

    await db
      .insert(modelLatencySamples)
      .values(values)
      .onConflictDoUpdate({
        target: [
          modelLatencySamples.permaslug,
          modelLatencySamples.endpointId,
          modelLatencySamples.observedAt,
        ],
        set: {
          latency: sql`excluded.latency`,
          scrapedAt: sql`excluded.scraped_at`,
        },
      });

    return samples.length;
  }

  async clearAll(): Promise<number> {
    const deleted = await db
      .delete(modelLatencySamples)
      .returning({ permaslug: modelLatencySamples.permaslug });
    return deleted.length;
  }

  async getSeries(permaslug: string, endpointId?: string): Promise<LatencySeriesPoint[]> {
    if (!permaslug) return [];

    const whereClause = endpointId
      ? and(
          eq(modelLatencySamples.permaslug, permaslug),
          eq(modelLatencySamples.endpointId, endpointId),
        )
      : eq(modelLatencySamples.permaslug, permaslug);

    const rows = await db
      .select()
      .from(modelLatencySamples)
      .where(whereClause)
      .orderBy(asc(modelLatencySamples.observedAt));

    return rows.map((row) => ({
      endpointId: row.endpointId,
      observedAt: row.observedAt?.toISOString() ?? new Date(0).toISOString(),
      latency: Number(row.latency ?? 0),
    }));
  }

  async getSeriesGrouped(permaslug: string): Promise<LatencySeriesGroup[]> {
    if (!permaslug) return [];
    const rows = await this.getSeries(permaslug);
    if (!rows.length) return [];

    const endpointIds = Array.from(new Set(rows.map((row) => row.endpointId))).filter(Boolean);
    let endpointMetadata: Record<string, { provider?: string | null; modelId?: string | null; slug?: string | null; shortName?: string | null; }> = {};

    if (endpointIds.length > 0) {
      const metadataRows = await db
        .select({
          endpointId: aiModels.endpointId,
          provider: aiModels.provider,
          modelId: aiModels.id,
          slug: aiModels.slug,
          shortName: aiModels.shortName,
        })
        .from(aiModels)
        .where(
          and(
            eq(aiModels.permaslug, permaslug),
            inArray(aiModels.endpointId, endpointIds),
          ),
        );

      endpointMetadata = metadataRows.reduce<Record<string, { provider?: string | null; modelId?: string | null; slug?: string | null; shortName?: string | null; }>>((acc, row) => {
        if (row.endpointId) {
          acc[row.endpointId] = {
            provider: row.provider,
            modelId: row.modelId,
            slug: row.slug,
            shortName: row.shortName,
          };
        }
        return acc;
      }, {});
    }

    const map = new Map<string, LatencySeriesGroup>();
    for (const point of rows) {
      if (!map.has(point.endpointId)) {
        const meta = endpointMetadata[point.endpointId] ?? {};
        map.set(point.endpointId, {
          endpointId: point.endpointId,
          provider: meta.provider ?? null,
          modelId: meta.modelId ?? null,
          slug: meta.slug ?? null,
          shortName: meta.shortName ?? null,
          data: [],
        });
      }
      map.get(point.endpointId)!.data.push(point);
    }

    return Array.from(map.values()).map((group) => ({
      ...group,
      data: group.data.sort((a, b) => a.observedAt.localeCompare(b.observedAt)),
    }));
  }
}

export const modelLatencyCache = new ModelLatencyCache();
