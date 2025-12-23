import type { ColumnSchema } from "./table/schema";
import type { ModelsColumnSchema } from "./models/models-schema";

export function stableGpuKey(
  row: Pick<
    ColumnSchema,
    "provider" | "gpu_model" | "item" | "sku" | "gpu_count" | "vram_gb" | "type"
  >
): string {
  const provider = row.provider?.toLowerCase().trim();
  const model = (row.gpu_model || "").toLowerCase().trim();
  const count = typeof row.gpu_count === "number" ? `${row.gpu_count}x` : "";
  const vram = typeof row.vram_gb === "number" ? `${row.vram_gb}gb` : "";
  const type = (row.type || "").toLowerCase().trim();
  // Include sku (instance_id) for providers with multiple machine types per GPU
  const sku = (row.sku || "").toLowerCase().trim();

  return [provider, sku, model, count, vram, type].filter(Boolean).join(":");
}

export function stableModelKey(
  row: Partial<Pick<ModelsColumnSchema, "id" | "slug" | "provider" | "name">>
): string {
  if (row.id) return row.id;
  const provider = row.provider?.toLowerCase().trim();
  const slug = row.slug?.toLowerCase().trim();
  const name = row.name?.toLowerCase().trim();
  return [provider, slug ?? name].filter(Boolean).join(":");
}

export function stableToolKey(
  row: Partial<{
    stable_key: string | null;
    id: string | number;
    name: string | null;
    developer: string | null;
    category: string | null;
  }>,
): string {
  // Prefer stable_key if present (DB column)
  if (row.stable_key) return row.stable_key;
  // Fallback to composite key for robustness
  const name = row.name?.toLowerCase().trim();
  const developer = row.developer?.toLowerCase().trim();
  const category = row.category?.toLowerCase().trim();
  return [name, developer, category].filter(Boolean).join(":");
}

