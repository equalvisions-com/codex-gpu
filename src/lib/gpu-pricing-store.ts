import { createHash } from "crypto";
import { db } from "@/db/client";
import { gpuPricing } from "@/db/schema";
import type { ProviderResult, PriceRow, ProviderSnapshot, Provider } from "@/types/pricing";
import type { RowWithId } from "@/types/api";
import { and, eq, sql } from "drizzle-orm";
import { stableGpuKey } from "@/components/infinite-table/stable-key";

type GpuPricingRow = typeof gpuPricing.$inferSelect;

function computeRowId(provider: string, observedAt: string, row: PriceRow): string {
  const hashInput = JSON.stringify({ provider, observed_at: observedAt, row });
  return createHash("sha256").update(hashInput).digest("hex");
}

function normalizeObservedAt(observedAt: string | Date): string {
  if (observedAt instanceof Date) {
    return observedAt.toISOString();
  }
  const parsed = new Date(observedAt);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function toRowWithId(record: GpuPricingRow): RowWithId {
  const data = record.data as PriceRow;
  const observedAtIso = normalizeObservedAt(record.observedAt);
  return {
    uuid: record.id,
    ...(data as any),
    provider: record.provider,
    observed_at: observedAtIso,
  } as RowWithId;
}

export class GpuPricingStore {
  /**
   * Replace all GPU pricing data with the latest scrape results.
   * The table is cleared before new rows are inserted to ensure parity with the models workflow.
   */
  async replaceAll(providerResults: ProviderResult[]): Promise<number> {
    if (!providerResults.length) {
      return 0;
    }

    console.log(`[GpuPricingStore] Replacing GPU pricing data for ${providerResults.length} providers...`);
    await db.delete(gpuPricing);

    let stored = 0;
    for (const result of providerResults) {
      const observedAtIso = normalizeObservedAt(result.observedAt);
      const version = typeof result.version === "number" ? result.version : 1;
      if (!result.rows.length) {
        continue;
      }

      for (const row of result.rows) {
        const id = computeRowId(result.provider, observedAtIso, row);
        const stableKey = stableGpuKey({
          provider: result.provider,
          gpu_model: (row as any).gpu_model,
          item: (row as any).item,
          sku: (row as any).sku,
          gpu_count: (row as any).gpu_count,
          vram_gb: (row as any).vram_gb,
          type: (row as any).type,
        } as any);
        try {
          await db.insert(gpuPricing).values({
            id,
            provider: result.provider,
            observedAt: new Date(observedAtIso),
            version,
            sourceHash: result.sourceHash,
            data: row,
            stableKey,
          });
          stored += 1;
        } catch (error) {
          console.error("[GpuPricingStore] Failed to store row", {
            provider: result.provider,
            id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    console.log(`[GpuPricingStore] Stored ${stored} GPU pricing rows`);
    return stored;
  }

  async getAllRows(): Promise<RowWithId[]> {
    const records = await db
      .select()
      .from(gpuPricing)
      .orderBy(gpuPricing.provider, gpuPricing.id);

    return records.map(toRowWithId);
  }

  async getRowsByProvider(provider: Provider): Promise<RowWithId[]> {
    const records = await db
      .select()
      .from(gpuPricing)
      .where(eq(gpuPricing.provider, provider))
      .orderBy(gpuPricing.id);

    return records.map(toRowWithId);
  }

  async getProviderSnapshots(): Promise<ProviderSnapshot[]> {
    const records = await db.select().from(gpuPricing);
    const map = new Map<Provider, { observedAt: Date; version: number; rows: PriceRow[] }>();

    for (const record of records) {
      const provider = record.provider as Provider;
      const entry = map.get(provider);
      if (!entry) {
        map.set(provider, {
          observedAt: record.observedAt,
          version: record.version,
          rows: [record.data as PriceRow],
        });
      } else {
        entry.rows.push(record.data as PriceRow);
        if (record.observedAt > entry.observedAt) {
          entry.observedAt = record.observedAt;
        }
        entry.version = Math.max(entry.version, record.version);
      }
    }

    return Array.from(map.entries()).map(([provider, value]) => ({
      provider,
      version: value.version,
      last_updated: normalizeObservedAt(value.observedAt),
      rows: value.rows,
    }));
  }

  async getSnapshotByProvider(provider: Provider): Promise<ProviderSnapshot | null> {
    const records = await db
      .select()
      .from(gpuPricing)
      .where(eq(gpuPricing.provider, provider));

    if (!records.length) return null;

    let latestObserved = records[0].observedAt;
    let version = records[0].version;
    const rows: PriceRow[] = [];

    for (const record of records) {
      rows.push(record.data as PriceRow);
      if (record.observedAt > latestObserved) {
        latestObserved = record.observedAt;
      }
      version = Math.max(version, record.version);
    }

    return {
      provider,
      version,
      last_updated: normalizeObservedAt(latestObserved),
      rows,
    };
  }

  async getInstance(provider: Provider, instanceId: string): Promise<PriceRow | null> {
    const records = await db
      .select()
      .from(gpuPricing)
      .where(
        and(
          eq(gpuPricing.provider, provider),
          sql`${gpuPricing.data}->>'instance_id' = ${instanceId}`
        )
      )
      .limit(1);

    if (!records.length) return null;
    return records[0].data as PriceRow;
  }

  async getCacheStats(): Promise<{
    totalRows: number;
    providers: string[];
    lastScrapedAt?: string;
  }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(gpuPricing);

    const providers = await db
      .select({ provider: gpuPricing.provider })
      .from(gpuPricing)
      .groupBy(gpuPricing.provider);

    const [latestResult] = await db
      .select({ observedAt: sql<string>`max(observed_at)` })
      .from(gpuPricing);

    return {
      totalRows: totalResult?.count ?? 0,
      providers: providers.map((row) => row.provider),
      lastScrapedAt: latestResult?.observedAt ?? undefined,
    };
  }

  async clearAll(): Promise<number> {
    const deleted = await db.delete(gpuPricing).returning({ id: gpuPricing.id });
    return deleted.length;
  }
}

export const gpuPricingStore = new GpuPricingStore();
