/**
 * Simple delay to avoid hammering provider APIs.
 * Default 200ms between requests.
 */
export function scraperDelay(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
