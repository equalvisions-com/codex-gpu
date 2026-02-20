import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/auth-schema";
import { ensureNewsletterSubscribed, unsubscribeNewsletter } from "@/lib/newsletter";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const PayloadSchema = z.object({
  email: z.string().email(),
  userId: z.string().optional(),
  forceUnsubscribe: z.boolean().optional(),
});

export const POST = verifySignatureAppRouter(async (req: Request) => {
  const parsed = PayloadSchema.safeParse(await req.json());
  if (!parsed.success) {
    logger.error("[newsletter-sync] Invalid payload", parsed.error.flatten());
    return Response.json({ ok: false, error: "Invalid payload" });
  }

  const { email, userId, forceUnsubscribe } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  if (forceUnsubscribe) {
    await unsubscribeNewsletter(normalizedEmail);
    return Response.json({ ok: true, action: "unsubscribe" });
  }

  const record = userId
    ? (
        await db
          .select({
            email: user.email,
            name: user.name,
            newsletterSubscribed: user.newsletterSubscribed,
          })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1)
      )[0]
    : (
        await db
          .select({
            email: user.email,
            name: user.name,
            newsletterSubscribed: user.newsletterSubscribed,
          })
          .from(user)
          .where(sql`lower(${user.email}) = ${normalizedEmail}`)
          .limit(1)
      )[0];

  if (!record) {
    return Response.json({ ok: true, skipped: true });
  }

  if (record.newsletterSubscribed) {
    await ensureNewsletterSubscribed({ email: record.email, name: record.name });
  } else {
    await unsubscribeNewsletter(record.email);
  }

  return Response.json({ ok: true });
});
