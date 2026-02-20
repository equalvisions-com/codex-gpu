/**
 * Normalizes GPU model names so the same physical GPU isn't split
 * across multiple facet entries due to provider naming inconsistencies.
 *
 * Applied at ingestion time (gpu-pricing-store.ts) before data hits the DB.
 */
export function normalizeGpuModel(name: string): string {
  if (!name) return name;

  let n = name;

  // Strip redundant SXM version numbers — the version is deterministic per chip:
  // H100/H200 are always SXM5, A100 is always SXM4, B200/B300 are always SXM6.
  n = n.replace(/\bSXM[456]\b/g, 'SXM');

  // Canonicalize RTX A-series: "NVIDIA A4000" → "NVIDIA RTX A4000"
  // Some providers omit the RTX prefix on professional Ampere cards.
  n = n.replace(/\bNVIDIA A([456]000)\b/, 'NVIDIA RTX A$1');

  // Normalize "RTX PRO 6000 Blackwell SE" → "RTX PRO 6000 SE"
  n = n.replace(/\bRTX PRO 6000 Blackwell SE\b/, 'RTX PRO 6000 SE');

  return n;
}
