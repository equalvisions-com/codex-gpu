import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { userToolFavorites } from "@/db/schema";
import { headers } from "next/headers";
import { eq, and, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { writeLimiter } from "@/lib/redis/ratelimit";
import { z } from "zod";
import type { ToolFavoritesRequest, ToolFavoritesResponse, ToolFavoriteKey } from "@/types/tool-favorites";
import { revalidateTag, revalidatePath, unstable_cache } from "next/cache";
import {
  TOOL_FAVORITES_CACHE_TTL,
  getToolFavoritesCacheTag,
  getToolFavoritesRateLimitKey,
} from "@/lib/tool-favorites/constants";

type UserToolFavoriteRow = {
  id: string;
  userId: string;
  toolId: number;
  createdAt: Date | null;
};

function buildRateHeaders(limit?: number, remaining?: number, reset?: number) {
  const headers: Record<string, string> = {};
  if (typeof limit === "number") headers["X-RateLimit-Limit"] = String(limit);
  if (typeof remaining === "number") headers["X-RateLimit-Remaining"] = String(remaining);
  if (typeof reset === "number") headers["X-RateLimit-Reset"] = String(reset);
  return headers;
}

export async function GET() {
  try {
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const getCachedFavorites = unstable_cache(
      async (userId: string) => {
        const rows = await db
          .select()
          .from(userToolFavorites)
          .where(eq(userToolFavorites.userId, userId));
        const typedRows = rows as unknown as UserToolFavoriteRow[];
        return (typedRows || []).map((r) => String(r.toolId) as ToolFavoriteKey);
      },
      ["tool-favorites:api", session.user.id],
      {
        revalidate: TOOL_FAVORITES_CACHE_TTL,
        tags: [getToolFavoritesCacheTag(session.user.id)],
      },
    );

    const favorites = await getCachedFavorites(session.user.id);

    return NextResponse.json<ToolFavoritesResponse>({ favorites });
  } catch (error) {
    console.error("[GET /api/tools/favorites] Failed to fetch favorites", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rate = await writeLimiter.limit(getToolFavoritesRateLimitKey(session.user.id));
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: buildRateHeaders(rate.limit, rate.remaining, rate.reset) },
      );
    }

    const BodySchema = z.object({
      toolIds: z.array(z.string().min(1).max(256)).min(1).max(50),
    });

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const toolIds = Array.from(new Set(parsed.data.toolIds));
    const numericToolIds = toolIds.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n));

    if (numericToolIds.length === 0) {
      return NextResponse.json({ error: "No valid tool IDs provided" }, { status: 400 });
    }

    const favoritesToInsert = numericToolIds.map((toolId) => ({
      id: crypto.randomUUID(),
      userId: session.user.id,
      toolId,
    }));

    await db.insert(userToolFavorites).values(favoritesToInsert).onConflictDoNothing();

    try {
      revalidateTag(getToolFavoritesCacheTag(session.user.id), "max");
      revalidateTag("tool-favorites", "max");
      revalidatePath("/api/tools/favorites/rows");
    } catch (error) {
      console.error("[POST /api/tools/favorites] Cache revalidation failed", {
        userId: session.user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json(
      { success: true },
      { headers: buildRateHeaders(rate.limit, rate.remaining, rate.reset) },
    );
  } catch (error) {
    console.error("[POST /api/tools/favorites] Database operation failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rate = await writeLimiter.limit(getToolFavoritesRateLimitKey(session.user.id));
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: buildRateHeaders(rate.limit, rate.remaining, rate.reset) },
      );
    }

    const BodySchema = z.object({
      toolIds: z.array(z.string().min(1).max(256)).min(1).max(50),
    });

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const toolIds = Array.from(new Set(parsed.data.toolIds));
    const numericToolIds = toolIds.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n));

    if (numericToolIds.length === 0) {
      return NextResponse.json({ error: "No valid tool IDs provided" }, { status: 400 });
    }

    await db
      .delete(userToolFavorites)
      .where(and(eq(userToolFavorites.userId, session.user.id), inArray(userToolFavorites.toolId, numericToolIds)));

    try {
      revalidateTag(getToolFavoritesCacheTag(session.user.id), "max");
      revalidateTag("tool-favorites", "max");
      revalidatePath("/api/tools/favorites/rows");
    } catch (error) {
      console.error("[DELETE /api/tools/favorites] Cache revalidation failed", {
        userId: session.user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json(
      { success: true },
      { headers: buildRateHeaders(rate.limit, rate.remaining, rate.reset) },
    );
  } catch (error) {
    console.error("[DELETE /api/tools/favorites] Database operation failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
