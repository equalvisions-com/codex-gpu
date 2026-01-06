import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { user } from "@/db/auth-schema";
import { enqueueNewsletterSync } from "@/lib/newsletter-queue";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

export async function GET() {
  try {
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders });
    }

    if (!session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Missing user identity" }, { status: 400, headers: noStoreHeaders });
    }

    const record = await db
      .select({ subscribed: user.newsletterSubscribed })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!record[0]) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: noStoreHeaders });
    }

    return NextResponse.json({ subscribed: record[0].subscribed }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[GET /api/newsletter] Failed to fetch status", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders });
    }

    if (!session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Missing user identity" }, { status: 400, headers: noStoreHeaders });
    }

    const BodySchema = z.object({ subscribed: z.boolean() });
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: noStoreHeaders });
    }

    const record = await db
      .select({ subscribed: user.newsletterSubscribed })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!record[0]) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: noStoreHeaders });
    }

    if (record[0].subscribed === parsed.data.subscribed) {
      return NextResponse.json(
        { subscribed: record[0].subscribed },
        { headers: noStoreHeaders }
      );
    }

    await db
      .update(user)
      .set({ newsletterSubscribed: parsed.data.subscribed })
      .where(eq(user.id, session.user.id));

    try {
      await enqueueNewsletterSync(
        { userId: session.user.id, email: session.user.email },
        request.url,
      );
    } catch (error) {
      console.error("[PATCH /api/newsletter] Failed to enqueue sync", error);
    }

    return NextResponse.json({ subscribed: parsed.data.subscribed }, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[PATCH /api/newsletter] Failed to update status", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
