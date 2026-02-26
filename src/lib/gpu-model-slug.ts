/**
 * Utilities for converting GPU model names to URL-friendly kebab-case slugs
 * and resolving them back to the original database values.
 *
 * Example: "NVIDIA H100 SXM" ↔ "nvidia-h100-sxm"
 */

/**
 * Convert a GPU model name to a URL-friendly kebab-case slug.
 *
 * "NVIDIA H100 SXM"  → "nvidia-h100-sxm"
 * "AMD MI325X"        → "amd-mi325x"
 * "NVIDIA A100 80GB"  → "nvidia-a100-80gb"
 */
export function toGpuModelSlug(modelName: string): string {
  return modelName
    .toLowerCase()
    .replace(/[_\s]+/g, "-") // spaces & underscores → hyphens
    .replace(/[^a-z0-9-]/g, "") // strip anything non-alphanumeric/hyphen
    .replace(/-{2,}/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}

/**
 * Resolve a URL slug back to the original GPU model name by matching against
 * the live facet data from the database.
 *
 * Returns the original (cased) model name, or `null` if no match is found.
 */
export function resolveGpuModelFromSlug(
  slug: string,
  facetRows: { value: string; total: number }[],
): string | null {
  for (const row of facetRows) {
    if (toGpuModelSlug(row.value) === slug) {
      return row.value;
    }
  }
  return null;
}
