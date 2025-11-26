import { db } from "@/db/client";
import { gpuPricing, userFavorites } from "@/db/schema";
import { eq, sql, inArray, and, or, ilike, between, asc, desc } from "drizzle-orm";
import { stableGpuKey } from "@/features/data-explorer/table/stable-key";
import type { SearchParamsType } from "@/features/data-explorer/table/search-params";
import type { RowWithId } from "@/types/api";
import { isArrayOfDates } from "@/lib/is-array";
import { normalizeObservedAt } from "@/lib/normalize-observed-at";
import { isSameDay } from "date-fns";
import type { SQL } from "drizzle-orm";

type GpuPricingRow = typeof gpuPricing.$inferSelect;

// Provider sort priority (matches route.ts)
const PROVIDER_SORT_PRIORITY: Record<string, number> = {
  coreweave: 1,
  lambda: 2,
  runpod: 3,
  digitalocean: 4,
  oracle: 5,
  nebius: 6,
  hyperstack: 7,
  crusoe: 8,
};
const PROVIDER_SORT_ORDER = [
  "coreweave",
  "lambda",
  "runpod",
  "digitalocean",
  "oracle",
  "nebius",
  "hyperstack",
  "crusoe",
];

const PROVIDER_PRIORITY_ARRAY_SQL = sql.raw(
  `ARRAY[${PROVIDER_SORT_ORDER.map((provider) => `'${provider}'`).join(", ")}]`,
);

const providerPriorityExpression = sql<number>`
  COALESCE(
    array_position(${PROVIDER_PRIORITY_ARRAY_SQL}, lower(${gpuPricing.provider})),
    999
  )
`;

const buildProviderOrderBy = (isDesc: boolean): SQL<unknown>[] => {
  const direction = isDesc ? sql.raw("DESC") : sql.raw("ASC");
  const providerNameExpr = sql`COALESCE(lower(${gpuPricing.provider}), '')`;
  return [
    sql`${providerPriorityExpression} ${direction}`,
    sql`${providerNameExpr} ${direction}`,
  ];
};

function toRowWithId(record: GpuPricingRow): RowWithId {
  const data = record.data as Record<string, any>;
  const observedAtIso = normalizeObservedAt(record.observedAt);
  
  // Extract price fields (canonical: price_hour_usd || price_usd)
  const priceHourUsd = typeof data.price_hour_usd === 'number' ? data.price_hour_usd : 
                      typeof data.price_usd === 'number' ? data.price_usd : undefined;
  
  return {
    uuid: record.id,
    ...data,
    provider: record.provider,
    observed_at: observedAtIso,
    price_hour_usd: priceHourUsd,
    stable_key: record.stableKey,
  } as RowWithId;
}

function buildGpuFilterConditions(search: SearchParamsType) {
  const conditions: any[] = [];

  // Provider filter (array or string)
  if (search.provider) {
    if (Array.isArray(search.provider) && search.provider.length > 0) {
      conditions.push(inArray(gpuPricing.provider, search.provider));
    } else if (typeof search.provider === "string") {
      conditions.push(ilike(gpuPricing.provider, `%${search.provider}%`));
    }
  }

  // Type filter (JSONB field)
  if (search.type) {
    if (Array.isArray(search.type) && search.type.length > 0) {
      const typeConditions = search.type.map(
        (type) => sql`${gpuPricing.data}->>'type' = ${type}`,
      );
      conditions.push(or(...typeConditions)!);
    } else if (typeof search.type === "string") {
      conditions.push(sql`${gpuPricing.data}->>'type' ILIKE ${`%${search.type}%`}`);
    }
  }

  // GPU model filter (JSONB field: gpu_model || item)
  if (search.gpu_model) {
    const normalize = (value: string) => value.trim().toLowerCase();
    const normalizedModels = Array.isArray(search.gpu_model)
      ? search.gpu_model.map((model) => normalize(model))
      : [normalize(search.gpu_model)];

    const modelConditions = normalizedModels.map((model) =>
      sql`lower(COALESCE(${gpuPricing.data}->>'gpu_model', ${gpuPricing.data}->>'item')) = ${model}`
    );

    if (modelConditions.length === 1) {
      conditions.push(modelConditions[0]);
    } else {
      conditions.push(or(...modelConditions)!);
    }
  }

  // VRAM filter (JSONB field, range)
  if (search.vram_gb && Array.isArray(search.vram_gb) && search.vram_gb.length > 0) {
    const [min, max] =
      search.vram_gb.length === 2 ? search.vram_gb : [search.vram_gb[0], search.vram_gb[0]];

    if (max >= 1000000) {
      // "1M or higher" - use >= min
      conditions.push(sql`CAST(${gpuPricing.data}->>'vram_gb' AS NUMERIC) >= ${min}`);
    } else {
      conditions.push(
        sql`CAST(${gpuPricing.data}->>'vram_gb' AS NUMERIC) BETWEEN ${min} AND ${max}`,
      );
    }
  }

  // Price filter (JSONB field: price_hour_usd || price_usd, range)
  if (
    search.price_hour_usd &&
    Array.isArray(search.price_hour_usd) &&
    search.price_hour_usd.length > 0
  ) {
    const [min, max] =
      search.price_hour_usd.length === 2
        ? search.price_hour_usd
        : [search.price_hour_usd[0], search.price_hour_usd[0]];

    // Use COALESCE to check both price_hour_usd and price_usd
    conditions.push(
      sql`COALESCE(
          CAST(${gpuPricing.data}->>'price_hour_usd' AS NUMERIC),
          CAST(${gpuPricing.data}->>'price_usd' AS NUMERIC)
        ) BETWEEN ${min} AND ${max}`,
    );
  }

  // Observed_at date filter
  if (search.observed_at && isArrayOfDates(search.observed_at)) {
    if (search.observed_at.length === 1) {
      // Single date: match same day
      const date = search.observed_at[0];
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(sql`${gpuPricing.observedAt} BETWEEN ${startOfDay} AND ${endOfDay}`);
    } else if (search.observed_at.length === 2) {
      // Date range
      conditions.push(
        sql`${gpuPricing.observedAt} BETWEEN ${search.observed_at[0]} AND ${search.observed_at[1]}`,
      );
    }
  }

  // Global search filter (across multiple JSONB fields)
  if (search.search && typeof search.search === "string") {
    const searchTerm = `%${search.search.toLowerCase()}%`;
    const textFields = [
      "gpu_model",
      "item",
      "provider",
      "type",
    ];

    const searchConditions = textFields.map(
      (field) => sql`${gpuPricing.data}->>${field} ILIKE ${searchTerm}`,
    );

    const numericFields = [
      "price_hour_usd",
      "price_usd",
      "gpu_count",
      "vram_gb",
      "vcpus",
      "system_ram_gb",
    ];

    numericFields.forEach((field) => {
      searchConditions.push(sql`CAST(${gpuPricing.data}->>${field} AS TEXT) ILIKE ${searchTerm}`);
    });

    conditions.push(or(...searchConditions)!);
  }

  return conditions;
}

class GpuPricingCache {
  /**
   * Get GPUs with database-level filtering, sorting, and pagination
   * This follows TanStack Table's recommended pattern for server-side pagination
   * 
   * @param search - Search parameters including filters, sort, and pagination
   * @returns Object containing paginated data and total count
   */
  async getGpusFiltered(
    search: SearchParamsType
  ): Promise<{ data: RowWithId[]; totalCount: number; filterCount: number }> {
    const conditions = buildGpuFilterConditions(search);
    const whereClause = conditions.length > 0 ? and(...conditions)! : undefined;

    // Get total count (for pagination)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(gpuPricing)
      .where(whereClause);

    const filterCount = Number(countResult?.count || 0);

    // Build ORDER BY clause
    let orderByClause;
    if (search.sort) {
      const { id, desc: isDesc } = search.sort;
      const direction = isDesc ? desc : asc;
      const sqlDirection = isDesc ? sql.raw('DESC') : sql.raw('ASC');
      const nullsPlacement = isDesc ? sql.raw('NULLS LAST') : sql.raw('NULLS FIRST');

      switch (id) {
        case 'provider':
          orderByClause = direction(gpuPricing.provider);
          break;
        case 'gpu_model':
          // JSONB field: gpu_model || item
          orderByClause = sql`COALESCE(${gpuPricing.data}->>'gpu_model', ${gpuPricing.data}->>'item') ${isDesc ? sql.raw('DESC') : sql.raw('ASC')}`;
          break;
        case 'price_hour_usd':
          // JSONB field: price_hour_usd || price_usd
          orderByClause = sql`COALESCE(
            CAST(${gpuPricing.data}->>'price_hour_usd' AS NUMERIC),
            CAST(${gpuPricing.data}->>'price_usd' AS NUMERIC)
          ) ${sqlDirection} ${nullsPlacement}`;
          break;
        case 'gpu_count':
          orderByClause = sql`CAST(${gpuPricing.data}->>'gpu_count' AS NUMERIC) ${sqlDirection} ${nullsPlacement}`;
          break;
        case 'system_ram_gb':
          // JSONB field: system_ram_gb
          orderByClause = sql`CAST(${gpuPricing.data}->>'system_ram_gb' AS NUMERIC) ${sqlDirection} ${nullsPlacement}`;
          break;
        case 'vcpus':
          // JSONB field: vcpus
          orderByClause = sql`CAST(${gpuPricing.data}->>'vcpus' AS NUMERIC) ${sqlDirection} ${nullsPlacement}`;
          break;
        case 'vram_gb':
          // JSONB field: vram_gb
          orderByClause = sql`CAST(${gpuPricing.data}->>'vram_gb' AS NUMERIC) ${sqlDirection} ${nullsPlacement}`;
          break;
        case 'type':
          orderByClause = sql`COALESCE(${gpuPricing.data}->>'type', '') ${sqlDirection}`;
          break;
        case 'observed_at':
          orderByClause = direction(gpuPricing.observedAt);
          break;
        default:
          // Default: sort by provider
          orderByClause = buildProviderOrderBy(false);
      }
    } else {
      // Default: sort by provider
      orderByClause = buildProviderOrderBy(false);
    }

    // Apply pagination
    const cursor = typeof search.cursor === 'number' && search.cursor >= 0 ? search.cursor : 0;
    const size = Math.min(Math.max(1, search.size ?? 50), 200); // Clamp size between 1 and 200

    // Execute query with filtering, sorting, and pagination
    const rows = await db
      .select()
      .from(gpuPricing)
      .where(whereClause)
      .orderBy(...(Array.isArray(orderByClause) ? orderByClause : [orderByClause]))
      .limit(size)
      .offset(cursor);

    const rawRows = rows.map(toRowWithId);

    return {
      data: rawRows,
      totalCount: filterCount, // Total matching filters
      filterCount: filterCount, // Same as totalCount (no separate unfiltered count needed)
    };
  }

  /**
   * Generate facets directly from database using SQL aggregations
   * This avoids loading all GPUs into memory (2MB cache limit issue)
   * Returns facet data: provider, type, gpu_model, vram_gb, price_hour_usd
   */
  async getGpusFacets(): Promise<{
    provider: { rows: { value: string; total: number }[]; total: number };
    type: { rows: { value: string; total: number }[]; total: number };
    gpu_model: { rows: { value: string; total: number }[]; total: number };
    vram_gb: { rows: { value: number; total: number }[]; total: number; min?: number; max?: number };
    price_hour_usd: { rows: { value: number; total: number }[]; total: number; min?: number; max?: number };
  }> {
    // Get total count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(gpuPricing);
    const totalCount = Number(totalResult?.count || 0);

    // Provider facet (GROUP BY provider)
    const providerRows = await db
      .select({
        provider: gpuPricing.provider,
        count: sql<number>`count(*)`,
      })
      .from(gpuPricing)
      .groupBy(gpuPricing.provider);

    const providerFacet = {
      rows: providerRows
        .map((r) => ({ value: r.provider, total: Number(r.count) }))
        .sort((a, b) => {
          const aPriority = PROVIDER_SORT_PRIORITY[a.value.toLowerCase()] || 999;
          const bPriority = PROVIDER_SORT_PRIORITY[b.value.toLowerCase()] || 999;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return a.value.localeCompare(b.value);
        }),
      total: totalCount,
    };

    // Type facet (JSONB field, GROUP BY)
    // Use db.execute for JSONB GROUP BY (same pattern as models table modalities facet)
    let typeRowsArray: Array<{ type: string; count: string | number }> = [];
    try {
      const typeRowsResult = await db.execute(sql`
        SELECT ${gpuPricing.data}->>'type' as type, COUNT(*) as count
        FROM ${gpuPricing}
        WHERE ${gpuPricing.data}->>'type' IS NOT NULL
        GROUP BY ${gpuPricing.data}->>'type'
        ORDER BY count DESC
      `);

      typeRowsArray = (typeRowsResult as unknown as Array<{ type: string; count: string | number }>);
    } catch (error) {
      console.warn("[getGpusFacets] Failed to generate type facet", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const typeFacet = {
      rows: typeRowsArray
        .map((r) => ({ value: r.type, total: Number(r.count) }))
        .sort((a, b) => a.value.localeCompare(b.value)),
      total: totalCount,
    };

    // GPU model facet (JSONB field: gpu_model || item, GROUP BY)
    let modelRowsArray: Array<{ model: string; count: string | number }> = [];
    try {
      const modelRowsResult = await db.execute(sql`
        SELECT 
          COALESCE(${gpuPricing.data}->>'gpu_model', ${gpuPricing.data}->>'item') as model,
          COUNT(*) as count
        FROM ${gpuPricing}
        WHERE COALESCE(${gpuPricing.data}->>'gpu_model', ${gpuPricing.data}->>'item') IS NOT NULL
        GROUP BY COALESCE(${gpuPricing.data}->>'gpu_model', ${gpuPricing.data}->>'item')
        ORDER BY count DESC
      `);

      modelRowsArray = (modelRowsResult as unknown as Array<{ model: string; count: string | number }>);
    } catch (error) {
      console.warn("[getGpusFacets] Failed to generate model facet", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const modelFacet = {
      rows: modelRowsArray
        .map((r) => ({ value: r.model, total: Number(r.count) }))
        .sort((a, b) => a.value.localeCompare(b.value)),
      total: totalCount,
    };

    // VRAM facet (JSONB field, numeric aggregation with min/max)
    let vramRowsArray: Array<{ vram: number | string; count: string | number }> = [];
    try {
      const vramRowsResult = await db.execute(sql`
        SELECT 
          CAST(${gpuPricing.data}->>'vram_gb' AS NUMERIC) as vram,
          COUNT(*) as count
        FROM ${gpuPricing}
        WHERE ${gpuPricing.data}->>'vram_gb' IS NOT NULL
          AND CAST(${gpuPricing.data}->>'vram_gb' AS NUMERIC) IS NOT NULL
        GROUP BY CAST(${gpuPricing.data}->>'vram_gb' AS NUMERIC)
        ORDER BY vram ASC
      `);

      vramRowsArray = (vramRowsResult as unknown as Array<{ vram: number | string; count: string | number }>);
    } catch (error) {
      console.warn("[getGpusFacets] Failed to generate VRAM facet", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const vramValues = vramRowsArray
      .map((r) => Number(r.vram))
      .filter((v) => Number.isFinite(v));

    const vramFacet = {
      rows: vramRowsArray
        .map((r) => ({ value: Number(r.vram), total: Number(r.count) }))
        .filter((r) => Number.isFinite(r.value))
        .sort((a, b) => a.value - b.value),
      total: totalCount,
      min: vramValues.length > 0 ? Math.min(...vramValues) : undefined,
      max: vramValues.length > 0 ? Math.max(...vramValues) : undefined,
    };

    // Price facet (JSONB field: price_hour_usd || price_usd, numeric aggregation with min/max)
    let priceRowsArray: Array<{ price: number | string; count: string | number }> = [];
    try {
      const priceRowsResult = await db.execute(sql`
        SELECT 
          COALESCE(
            CAST(${gpuPricing.data}->>'price_hour_usd' AS NUMERIC),
            CAST(${gpuPricing.data}->>'price_usd' AS NUMERIC)
          ) as price,
          COUNT(*) as count
        FROM ${gpuPricing}
        WHERE COALESCE(
          CAST(${gpuPricing.data}->>'price_hour_usd' AS NUMERIC),
          CAST(${gpuPricing.data}->>'price_usd' AS NUMERIC)
        ) IS NOT NULL
        GROUP BY COALESCE(
          CAST(${gpuPricing.data}->>'price_hour_usd' AS NUMERIC),
          CAST(${gpuPricing.data}->>'price_usd' AS NUMERIC)
        )
        ORDER BY price ASC
      `);

      priceRowsArray = (priceRowsResult as unknown as Array<{ price: number | string; count: string | number }>);
    } catch (error) {
      console.warn("[getGpusFacets] Failed to generate price facet", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const priceValues = priceRowsArray
      .map((r) => Number(r.price))
      .filter((v) => Number.isFinite(v));

    const priceFacet = {
      rows: priceRowsArray
        .map((r) => ({ value: Number(r.price), total: Number(r.count) }))
        .filter((r) => Number.isFinite(r.value))
        .sort((a, b) => a.value - b.value),
      total: totalCount,
      min: priceValues.length > 0 ? Math.min(...priceValues) : undefined,
      max: priceValues.length > 0 ? Math.max(...priceValues) : undefined,
    };

    return {
      provider: providerFacet,
      type: typeFacet,
      gpu_model: modelFacet,
      vram_gb: vramFacet,
      price_hour_usd: priceFacet,
    };
  }

  /**
   * Get favorite GPUs with database-level filtering, sorting, and pagination
   * This follows TanStack Table's recommended pattern for server-side pagination
   * Uses JOIN to combine userFavorites with gpuPricing
   * 
   * @param userId - User ID to filter favorites
   * @param search - Search parameters including sort and pagination
   * @returns Object containing paginated data and total count
   */
  async getFavoriteGpusFiltered(
    userId: string,
    search: SearchParamsType
  ): Promise<{ data: RowWithId[]; totalCount: number; filterCount: number }> {
    const filterConditions = buildGpuFilterConditions(search);

    // Build ORDER BY clause (same logic as getGpusFiltered)
    const defaultOrderBy = [desc(userFavorites.createdAt), asc(gpuPricing.provider)];
    let orderByClause: any;
    if (search.sort) {
      const { id, desc: isDesc } = search.sort;
      const direction = isDesc ? desc : asc;
      const sqlDirection = isDesc ? sql.raw('DESC') : sql.raw('ASC');
      const nullsPlacement = isDesc ? sql.raw('NULLS LAST') : sql.raw('NULLS FIRST');

      switch (id) {
        case 'provider':
          orderByClause = direction(gpuPricing.provider);
          break;
        case 'gpu_model':
          // JSONB field: gpu_model || item
          orderByClause = sql`COALESCE(${gpuPricing.data}->>'gpu_model', ${gpuPricing.data}->>'item') ${isDesc ? sql.raw('DESC') : sql.raw('ASC')}`;
          break;
        case 'price_hour_usd':
          // JSONB field: price_hour_usd || price_usd
          orderByClause = sql`COALESCE(
            CAST(${gpuPricing.data}->>'price_hour_usd' AS NUMERIC),
            CAST(${gpuPricing.data}->>'price_usd' AS NUMERIC)
          ) ${sqlDirection} ${nullsPlacement}`;
          break;
        case 'gpu_count':
          orderByClause = sql`CAST(${gpuPricing.data}->>'gpu_count' AS NUMERIC) ${sqlDirection} ${nullsPlacement}`;
          break;
        case 'system_ram_gb':
          // JSONB field: system_ram_gb
          orderByClause = sql`CAST(${gpuPricing.data}->>'system_ram_gb' AS NUMERIC) ${sqlDirection} ${nullsPlacement}`;
          break;
        case 'vcpus':
          // JSONB field: vcpus
          orderByClause = sql`CAST(${gpuPricing.data}->>'vcpus' AS NUMERIC) ${sqlDirection} ${nullsPlacement}`;
          break;
        case 'vram_gb':
          // JSONB field: vram_gb
          orderByClause = sql`CAST(${gpuPricing.data}->>'vram_gb' AS NUMERIC) ${sqlDirection} ${nullsPlacement}`;
          break;
        case 'type':
          orderByClause = sql`COALESCE(${gpuPricing.data}->>'type', '') ${sqlDirection}`;
          break;
        case 'observed_at':
          orderByClause = direction(gpuPricing.observedAt);
          break;
        default:
          orderByClause = defaultOrderBy;
      }
    }

    if (!Array.isArray(orderByClause)) {
      orderByClause = orderByClause ? [orderByClause] : defaultOrderBy;
    }

    // Apply pagination
    const cursor = typeof search.cursor === 'number' && search.cursor >= 0 ? search.cursor : 0;
    const size = Math.min(Math.max(1, search.size ?? 50), 200); // Clamp size between 1 and 200

    // Get total count of favorites for this user (without filters)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userFavorites)
      .where(eq(userFavorites.userId, userId));

    const totalCount = Number(countResult?.count || 0);

    const whereClause =
      filterConditions.length > 0
        ? and(eq(userFavorites.userId, userId), ...filterConditions)!
        : eq(userFavorites.userId, userId);

    const [filteredCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userFavorites)
      .innerJoin(gpuPricing, eq(userFavorites.gpuUuid, gpuPricing.stableKey))
      .where(whereClause);

    const filterCount = Number(filteredCountResult?.count || 0);

    if (filterCount === 0) {
      return {
        data: [],
        totalCount,
        filterCount: 0,
      };
    }

    // Execute query with JOIN, sorting, and pagination at database level
    // JOIN userFavorites with gpuPricing by computing stable key in SQL
    // Stable key format: provider:gpu_model:gpu_count:vram_gb:type
    // All fields lowercased and trimmed, joined with colons
    const rows = await db
      .select({
        id: gpuPricing.id,
        provider: gpuPricing.provider,
        observedAt: gpuPricing.observedAt,
        version: gpuPricing.version,
        sourceHash: gpuPricing.sourceHash,
        data: gpuPricing.data,
        stableKey: gpuPricing.stableKey,
        createdAt: gpuPricing.createdAt,
      })
      .from(userFavorites)
      .innerJoin(gpuPricing, eq(userFavorites.gpuUuid, gpuPricing.stableKey))
      .where(whereClause)
      .orderBy(...orderByClause)
      .limit(size)
      .offset(cursor);

    const rawRows = rows.map(toRowWithId);

    return {
      data: rawRows,
      totalCount,
      filterCount,
    };
  }

  async getGpusByIds(uuids: string[]): Promise<RowWithId[]> {
    if (uuids.length === 0) {
      return [];
    }

    const uniqueUuids = Array.from(new Set(uuids));
    const rows = await db
      .select()
      .from(gpuPricing)
      .where(inArray(gpuPricing.id, uniqueUuids));

    return rows.map(toRowWithId);
  }

  /**
   * Get GPUs by stable keys (for favorites lookup)
   * Since GPU UUIDs change between scrapes, we use stable keys to identify GPU configurations
   * Uses SQL JOIN to match stable keys at database level (no in-memory processing)
   */
  async getGpusByStableKeys(stableKeys: string[]): Promise<RowWithId[]> {
    if (stableKeys.length === 0) {
      return [];
    }

    const uniqueStableKeys = Array.from(new Set(stableKeys));

    // Use SQL to match stable keys at database level
    // This avoids loading all GPUs into memory
    // Build OR conditions for each stable key (more reliable than ANY with array parameter)
    const rows = await db
      .select({
        id: gpuPricing.id,
        provider: gpuPricing.provider,
        observedAt: gpuPricing.observedAt,
        version: gpuPricing.version,
        sourceHash: gpuPricing.sourceHash,
        data: gpuPricing.data,
        stableKey: gpuPricing.stableKey,
        createdAt: gpuPricing.createdAt,
      })
      .from(gpuPricing)
      .where(inArray(gpuPricing.stableKey, uniqueStableKeys));

    return rows.map(toRowWithId);
  }

  /**
   * Get all rows (for backward compatibility / migration)
   */
  async getAllRows(): Promise<RowWithId[]> {
    const records = await db
      .select()
      .from(gpuPricing)
      .orderBy(gpuPricing.provider, gpuPricing.id);

    return records.map(toRowWithId);
  }
}

// Export singleton instance
export const gpuPricingCache = new GpuPricingCache();
