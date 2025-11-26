import type { ColumnSchema } from "@/features/data-explorer/table/schema";
import type { RowWithId } from "@/types/api";

export function mapGpuRowToColumnSchema(row: RowWithId): ColumnSchema {
  return {
    uuid: row.uuid,
    stable_key: row.stable_key,
    provider: row.provider as ColumnSchema["provider"],
    source_url: row.source_url,
    observed_at: row.observed_at,
    item: typeof row.item === "string" ? row.item : undefined,
    sku: typeof row.sku === "string" ? row.sku : undefined,
    gpu_model: typeof row.gpu_model === "string" ? row.gpu_model : undefined,
    gpu_count:
      typeof row.gpu_count === "number" ? row.gpu_count : undefined,
    vram_gb:
      typeof row.vram_gb === "number" ? row.vram_gb : undefined,
    vcpus:
      typeof row.vcpus === "number" || typeof row.vcpus === "string"
        ? row.vcpus
        : undefined,
    system_ram_gb:
      typeof row.system_ram_gb === "number" ? row.system_ram_gb : undefined,
    price_hour_usd:
      typeof row.price_hour_usd === "number" ? row.price_hour_usd : undefined,
    price_usd:
      typeof row.price_usd === "number" ? row.price_usd : undefined,
    type: typeof row.type === "string" ? row.type : undefined,
  } as ColumnSchema;
}
