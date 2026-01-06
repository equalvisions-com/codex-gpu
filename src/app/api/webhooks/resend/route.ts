import { sql } from "drizzle-orm";
import { Webhook } from "svix";
import { db } from "@/db/client";
import { user } from "@/db/auth-schema";

export const dynamic = "force-dynamic";

type ContactWebhookPayload = {
  type: "contact.created" | "contact.updated";
  data: {
    email: string;
    unsubscribed: boolean;
  };
};

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json({ error: "Missing RESEND_WEBHOOK_SECRET" }, { status: 500 });
  }

  const payload = await request.text();
  const svixId = request.headers.get("svix-id") ?? "";
  const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
  const svixSignature = request.headers.get("svix-signature") ?? "";

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "Missing webhook signature headers" }, { status: 400 });
  }

  let event: ContactWebhookPayload;
  try {
    const webhook = new Webhook(webhookSecret);
    event = webhook.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ContactWebhookPayload;
  } catch (error) {
    console.error("[resend-webhook] Signature verification failed", error);
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type !== "contact.created" && event.type !== "contact.updated") {
    return Response.json({ ok: true, ignored: true });
  }

  const email = event.data.email?.trim().toLowerCase();
  if (!email) {
    return Response.json({ ok: true, ignored: true });
  }

  await db
    .update(user)
    .set({ newsletterSubscribed: !event.data.unsubscribed })
    .where(sql`lower(${user.email}) = ${email}`);

  return Response.json({ ok: true });
}
