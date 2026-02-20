/**
 * Shared cache constants for API routes
 * Centralizes cache TTL values for consistency across the application
 */

/** Standard cache revalidation time (12 hours in seconds) */
export const STANDARD_CACHE_TTL = 43200;

/** Maximum size for Next.js unstable_cache entries (2 MB) */
export const CACHE_SIZE_LIMIT_BYTES = 2 * 1024 * 1024;

/** Default page size for paginated queries */
export const DEFAULT_PAGE_SIZE = 50;

/** Maximum page size for paginated queries */
export const MAX_PAGE_SIZE = 200;

