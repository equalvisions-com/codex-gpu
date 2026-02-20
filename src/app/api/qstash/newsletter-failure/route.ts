import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const POST = verifySignatureAppRouter(async (req: Request) => {
  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }

  const metadata = Object.fromEntries(
    [...req.headers.entries()].filter(([key]) => key.startsWith("upstash-"))
  );

  logger.error("[newsletter-sync] QStash failure", {
    headers: metadata,
    payload,
  });

  return Response.json({ ok: true });
});
