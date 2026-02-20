import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Use Upstash Redis env config for ratelimit (separate from our json client)
const redis = Redis.fromEnv();

// Writes: stricter
export const writeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(100, "24 h"),
  prefix: "ratelimit:write",
});

// Reads: higher limit for public GET endpoints
export const readLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(200, "1 m"),
  prefix: "ratelimit:read",
});

// Newsletter subscribe: stricter to prevent abuse
export const newsletterLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(5, "1 h"),
  prefix: "ratelimit:newsletter",
});

/** Rate limit key for public read endpoints (IP-based) */
export function getReadRateLimitKey(ip: string): string {
  return `read:${ip}`;
}

/** Rate limit key for newsletter subscribe (IP-based) */
export function getNewsletterRateLimitKey(ip: string): string {
  return `newsletter:${ip}`;
}