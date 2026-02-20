import { logger } from "@/lib/logger";

export interface PriceRowValidation {
  provider: string;
  gpuModel?: string;
  pricePerHour?: number;
  gpuCount?: number;
  vram?: number;
}

/**
 * Validates scraped GPU pricing data. Returns true if the row looks reasonable.
 * Logs warnings for suspicious but not fatal data.
 */
export function validatePriceRow(row: PriceRowValidation): boolean {
  if (!row.provider) {
    logger.warn("[validation] Row missing provider, skipping");
    return false;
  }

  if (row.pricePerHour !== undefined) {
    if (row.pricePerHour < 0) {
      logger.warn(`[validation] Negative price ${row.pricePerHour} for ${row.provider}/${row.gpuModel}, skipping`);
      return false;
    }
    if (row.pricePerHour > 1000) {
      logger.warn(`[validation] Suspiciously high price $${row.pricePerHour}/hr for ${row.provider}/${row.gpuModel}`);
      // Don't skip, just warn - some multi-GPU configs can be expensive
    }
  }

  if (row.gpuCount !== undefined && (row.gpuCount < 1 || row.gpuCount > 64)) {
    logger.warn(`[validation] Invalid GPU count ${row.gpuCount} for ${row.provider}/${row.gpuModel}, skipping`);
    return false;
  }

  if (row.vram !== undefined && (row.vram < 1 || row.vram > 1000)) {
    logger.warn(`[validation] Invalid VRAM ${row.vram}GB for ${row.provider}/${row.gpuModel}, skipping`);
    return false;
  }

  return true;
}

/**
 * Simple delay to avoid hammering provider APIs.
 * Default 200ms between requests.
 */
export function scraperDelay(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
