import { db } from "@/db/client";
import { aiModels, modelThroughputSamples } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

export interface ThroughputSampleInput {
  permaslug: string;
  endpointId: string;
  observedAt: Date;
  throughput: number;
  scrapedAt?: Date;
}

interface ThroughputSeriesPoint {
  endpointId: string;
  observedAt: string;
  throughput: number;
}

interface ThroughputSeriesGroup {
  endpointId: string;
  provider?: string | null;
  modelId?: string | null;
  slug?: string | null;
  shortName?: string | null;
  data: ThroughputSeriesPoint[];
}

class ModelThroughputCache {
  async upsertSamples(samples: ThroughputSampleInput[]): Promise<number> {
    if (!samples.length) {
      return 0;
    }

    const values = samples.map((sample) => ({
      permaslug: sample.permaslug,
      endpointId: sample.endpointId,
      observedAt: sample.observedAt,
      throughput: sample.throughput,
      scrapedAt: sample.scrapedAt ?? new Date(),
    }));

    await db
      .insert(modelThroughputSamples)
      .values(values)
      .onConflictDoUpdate({
        target: [
          modelThroughputSamples.permaslug,
          modelThroughputSamples.endpointId,
          modelThroughputSamples.observedAt,
        ],
        set: {
          throughput: sql`excluded.throughput`,
          scrapedAt: sql`excluded.scraped_at`,
        },
      });

    return samples.length;
  }

  async clearAll(): Promise<number> {
    const deleted = await db
      .delete(modelThroughputSamples)
      .returning({ permaslug: modelThroughputSamples.permaslug });
    return deleted.length;
  }

  async resetModelThroughput(): Promise<number> {
    const result = await db.execute(sql`UPDATE ai_models SET throughput = NULL`);
    // rowCount exists at runtime on postgres.js results but is not in Drizzle's type definitions
    return Number((result as unknown as { rowCount?: number })?.rowCount ?? 0);
  }

  async syncLatestThroughputToModels(): Promise<number> {
    const result = await db.execute(sql`
      UPDATE ai_models AS m
      SET throughput = latest.throughput
      FROM (
        SELECT DISTINCT ON (endpoint_id)
          endpoint_id,
          throughput
        FROM model_throughput_samples
        WHERE throughput IS NOT NULL
        ORDER BY endpoint_id, observed_at DESC
      ) AS latest
      WHERE m.endpoint_id = latest.endpoint_id
    `);

    // rowCount exists at runtime on postgres.js results but is not in Drizzle's type definitions
    return Number((result as unknown as { rowCount?: number })?.rowCount ?? 0);
  }

  async getSeries(permaslug: string, endpointId?: string): Promise<ThroughputSeriesPoint[]> {
    if (!permaslug) return [];

    const whereClause = endpointId
      ? and(
          eq(modelThroughputSamples.permaslug, permaslug),
          eq(modelThroughputSamples.endpointId, endpointId),
        )
      : eq(modelThroughputSamples.permaslug, permaslug);

    const rows = await db
      .select()
      .from(modelThroughputSamples)
      .where(whereClause)
      .orderBy(asc(modelThroughputSamples.observedAt));

    return rows.map((row) => ({
      endpointId: row.endpointId,
      observedAt: row.observedAt?.toISOString() ?? new Date(0).toISOString(),
      throughput: Number(row.throughput ?? 0),
    }));
  }

  async getSeriesGrouped(permaslug: string): Promise<ThroughputSeriesGroup[]> {
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

    const map = new Map<string, ThroughputSeriesGroup>();
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

export const modelThroughputCache = new ModelThroughputCache();
