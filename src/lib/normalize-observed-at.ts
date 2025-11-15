const HAS_TIMEZONE = /([zZ]|[+-]\d{2}:?\d{2})$/;
const BASIC_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_NO_TZ = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/;

function coerceToIsoString(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  if (HAS_TIMEZONE.test(trimmed)) {
    return trimmed.replace(" ", "T");
  }

  if (BASIC_DATE.test(trimmed)) {
    return `${trimmed}T00:00:00Z`;
  }

  if (DATE_TIME_NO_TZ.test(trimmed)) {
    const withT = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
    return `${withT}Z`;
  }

  return trimmed;
}

/**
 * Normalizes scraper-provided timestamps so timezone-less strings are treated as UTC
 * instead of being reinterpreted in the server's local timezone (which shifts the date).
 */
export function normalizeObservedAt(value: string | Date | null | undefined): string {
  const fallback = new Date().toISOString();

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : value.toISOString();
  }

  if (typeof value === "string") {
    const isoReady = coerceToIsoString(value);
    const parsed = new Date(isoReady);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
  }

  return fallback;
}

export function normalizeObservedAtDate(value: string | Date | null | undefined): Date {
  const iso = normalizeObservedAt(value);
  return new Date(iso);
}
