import type { NextRequest } from "next/server";

/**
 * Determines whether the inbound request was triggered by a Vercel Cron job.
 * Cron jobs automatically attach the configured CRON_SECRET as
 * `Authorization: Bearer ...`, so we compare here and allow the route handlers
 * to short-circuit if the secret doesn't match.
 */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[cron] CRON_SECRET missing; allowing request because NODE_ENV != production.");
      return true;
    }
    console.warn("[cron] CRON_SECRET is not configured; rejecting cron request.");
    return false;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}
