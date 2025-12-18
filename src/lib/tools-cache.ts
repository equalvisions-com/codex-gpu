import { db } from "@/db/client";
import { tools, userToolFavorites } from "@/db/schema";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { ToolsSearchParamsType } from "@/features/data-explorer/tools/tools-search-params";
import type { Tool } from "@/types/tools";
import { stableToolKey } from "@/features/data-explorer/stable-keys";

type ToolRow = typeof tools.$inferSelect;

const parseNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return String(value);
};

const buildNameOrder = (isDesc: boolean): SQL<unknown> => {
  const direction = isDesc ? sql.raw("DESC") : sql.raw("ASC");
  const normalized = sql`COALESCE(lower(trim(${tools.name})), '')`;
  return sql`${normalized} ${direction}`;
};

const mapRowToTool = (row: ToolRow): Tool => {
  return {
    id: row.id,
    name: parseNullableString(row.name),
    developer: parseNullableString(row.developer),
    description: parseNullableString(row.description),
    category: parseNullableString(row.category),
    price: parseNullableString(row.price),
    license: parseNullableString(row.license),
    url: parseNullableString(row.url),
    stack: parseNullableString(row.stack),
    oss: parseNullableString(row.oss),
    stableKey: parseNullableString(row.stableKey),
  };
};

function buildToolFilterConditions(search: ToolsSearchParamsType) {
  const conditions: SQL<unknown>[] = [];

  if (search.developer && search.developer.length > 0) {
    conditions.push(inArray(tools.developer, search.developer));
  }

  if (search.category && search.category.length > 0) {
    conditions.push(inArray(tools.category, search.category));
  }

  if (search.stack && search.stack.length > 0) {
    conditions.push(inArray(tools.stack, search.stack));
  }

  if (search.oss && search.oss.length > 0) {
    conditions.push(inArray(tools.oss, search.oss));
  }

  if (search.search) {
    const term = `%${search.search}%`;
    conditions.push(
      or(
        ilike(tools.name, term),
        ilike(tools.description, term),
        ilike(tools.developer, term),
        ilike(tools.category, term),
        ilike(tools.price, term),
        ilike(tools.license, term),
        ilike(tools.url, term),
        ilike(tools.stack, term),
        ilike(tools.oss, term),
      )!,
    );
  }

  return conditions;
}

class ToolsCache {
  async getToolsFiltered(
    search: ToolsSearchParamsType,
  ): Promise<{ data: Tool[]; totalCount: number; filterCount: number }> {
    const conditions = buildToolFilterConditions(search);
    const whereClause = conditions.length > 0 ? and(...conditions)! : undefined;

    const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(tools);
    const totalCount = Number(totalResult?.count || 0);

    const filterCount = whereClause
      ? Number(
        (
          await db
            .select({ count: sql<number>`count(*)` })
            .from(tools)
            .where(whereClause)
        )[0]?.count || 0,
      )
      : totalCount;

    let orderByClause: SQL<unknown> | SQL<unknown>[];
    if (search.sort) {
      const { id, desc: isDesc } = search.sort;
      const direction = isDesc ? desc : asc;
      const sqlDirection = isDesc ? sql.raw("DESC") : sql.raw("ASC");
      switch (id) {
        case "name":
          orderByClause = buildNameOrder(isDesc);
          break;
        case "description":
          orderByClause = sql`COALESCE(lower(${tools.description}), '') ${sqlDirection}`;
          break;
        case "developer":
          orderByClause = direction(tools.developer);
          break;
        case "license":
          orderByClause = direction(tools.license);
          break;
        case "category":
          orderByClause = direction(tools.category);
          break;
        case "price":
          orderByClause = direction(tools.price);
          break;
        case "stack":
          orderByClause = direction(tools.stack);
          break;
        case "oss":
          orderByClause = direction(tools.oss);
          break;
        default:
          orderByClause = asc(tools.id);
      }
    } else {
      orderByClause = asc(tools.id);
    }

    const cursor = typeof search.cursor === "number" && search.cursor >= 0 ? search.cursor : 0;
    const size = Math.min(Math.max(1, search.size ?? 50), 200);

    const rows = await db
      .select()
      .from(tools)
      .where(whereClause)
      .orderBy(...(Array.isArray(orderByClause) ? orderByClause : [orderByClause]))
      .limit(size)
      .offset(cursor);

    return {
      data: rows.map(mapRowToTool),
      totalCount,
      filterCount,
    };
  }

  async getToolFacets() {
    const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(tools);
    const totalCount = Number(totalResult?.count || 0);

    const developerRows = await db
      .select({ value: tools.developer, total: sql<number>`count(*)` })
      .from(tools)
      .groupBy(tools.developer);

    const licenseRows = await db
      .select({ value: tools.license, total: sql<number>`count(*)` })
      .from(tools)
      .groupBy(tools.license);

    const categoryRows = await db
      .select({ value: tools.category, total: sql<number>`count(*)` })
      .from(tools)
      .groupBy(tools.category);

    const stackRows = await db
      .select({ value: tools.stack, total: sql<number>`count(*)` })
      .from(tools)
      .groupBy(tools.stack);

    const ossRows = await db
      .select({ value: tools.oss, total: sql<number>`count(*)` })
      .from(tools)
      .groupBy(tools.oss);

    const priceRows = await db
      .select({ value: tools.price, total: sql<number>`count(*)` })
      .from(tools)
      .groupBy(tools.price);

    return {
      developer: { rows: developerRows.map((r) => ({ value: r.value, total: Number(r.total) })), total: totalCount },
      license: { rows: licenseRows.map((r) => ({ value: r.value, total: Number(r.total) })), total: totalCount },
      category: { rows: categoryRows.map((r) => ({ value: r.value, total: Number(r.total) })), total: totalCount },
      stack: { rows: stackRows.map((r) => ({ value: r.value, total: Number(r.total) })), total: totalCount },
      oss: { rows: ossRows.map((r) => ({ value: r.value, total: Number(r.total) })), total: totalCount },
      price: { rows: priceRows.map((r) => ({ value: r.value, total: Number(r.total) })), total: totalCount },
    };
  }

  async getFavoriteToolsFiltered(
    userId: string,
    search: ToolsSearchParamsType,
  ): Promise<{ data: Tool[]; totalCount: number; filterCount: number }> {
    const filterConditions = buildToolFilterConditions(search);
    const defaultOrderBy = [desc(userToolFavorites.createdAt), asc(tools.name)];

    let orderByClause: SQL<unknown> | SQL<unknown>[] | undefined;
    if (search.sort) {
      const { id, desc: isDesc } = search.sort;
      const direction = isDesc ? desc : asc;
      const sqlDirection = isDesc ? sql.raw("DESC") : sql.raw("ASC");
      switch (id) {
        case "name":
          orderByClause = buildNameOrder(isDesc);
          break;
        case "description":
          orderByClause = sql`COALESCE(lower(${tools.description}), '') ${sqlDirection}`;
          break;
        case "developer":
          orderByClause = direction(tools.developer);
          break;
        case "license":
          orderByClause = direction(tools.license);
          break;
        case "category":
          orderByClause = direction(tools.category);
          break;
        case "price":
          orderByClause = direction(tools.price);
          break;
        case "stack":
          orderByClause = direction(tools.stack);
          break;
        case "oss":
          orderByClause = direction(tools.oss);
          break;
        default:
          orderByClause = defaultOrderBy;
      }
    }

    if (!Array.isArray(orderByClause)) {
      orderByClause = orderByClause ? [orderByClause] : defaultOrderBy;
    }

    const cursor = typeof search.cursor === "number" && search.cursor >= 0 ? search.cursor : 0;
    const size = Math.min(Math.max(1, search.size ?? 50), 200);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userToolFavorites)
      .where(eq(userToolFavorites.userId, userId));

    const totalCount = Number(countResult?.count || 0);

    const whereClause =
      filterConditions.length > 0
        ? and(eq(userToolFavorites.userId, userId), ...filterConditions)!
        : eq(userToolFavorites.userId, userId);

    const [filteredCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userToolFavorites)
      .innerJoin(tools, eq(userToolFavorites.toolId, tools.id))
      .where(whereClause);

    const filterCount = Number(filteredCountResult?.count || 0);

    if (filterCount === 0) {
      return { data: [], totalCount, filterCount: 0 };
    }

    const rows = await db
      .select({
        id: tools.id,
        name: tools.name,
        developer: tools.developer,
        description: tools.description,
        category: tools.category,
        price: tools.price,
        license: tools.license,
        url: tools.url,
        stack: tools.stack,
        oss: tools.oss,
        stableKey: tools.stableKey,
      })
      .from(userToolFavorites)
      .innerJoin(tools, eq(userToolFavorites.toolId, tools.id))
      .where(whereClause)
      .orderBy(...orderByClause)
      .limit(size)
      .offset(cursor);

    return {
      data: rows.map(mapRowToTool),
      totalCount,
      filterCount,
    };
  }

  async getToolsByStableKeys(stableKeys: string[]): Promise<Tool[]> {
    if (!stableKeys.length) return [];
    const uniqueKeys = Array.from(new Set(stableKeys));
    const rows = await db
      .select()
      .from(tools)
      .where(inArray(tools.stableKey, uniqueKeys));
    return rows.map(mapRowToTool);
  }

  async getToolsByIds(ids: number[]): Promise<Tool[]> {
    if (!ids.length) return [];
    const unique = Array.from(new Set(ids));
    const rows = await db.select().from(tools).where(inArray(tools.id, unique));
    return rows.map(mapRowToTool);
  }
}

export const toolsCache = new ToolsCache();
