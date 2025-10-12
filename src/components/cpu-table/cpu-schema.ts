import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@/lib/delimiters";
import { z } from "zod";

// CPU instance pricing schema
export const cpuColumnSchema = z.object({
  // Unique identifier for table operations
  uuid: z.string(),

  // Core identification (from PriceRow)
  provider: z.enum(["coreweave", "nebius", "hyperstack", "runpod", "lambda", "digitalocean", "oracle", "crusoe"]),
  source_url: z.string(),
  observed_at: z.string(),
  item: z.string().optional(), // For Nebius data
  sku: z.string().optional(),
  region: z.string().optional(),
  zone: z.string().optional(),

  // Hardware
  cpu_model: z.string().optional(),
  gpu_model: z.string().optional(), // May be present in some CPU data
  gpu_count: z.number().optional(),
  vram_gb: z.number().optional(),
  vcpus: z.union([z.number(), z.string()]).optional(),
  system_ram_gb: z.number().optional(),
  ram_gb: z.string().optional(), // For Nebius data
  local_storage_tb: z.number().optional(),
  cpu_type: z.string().optional(), // CPU-specific field

  // Pricing
  price_unit: z.enum(["hour", "month", "gb_month", "gpu_hour"]),
  price_hour_usd: z.number().optional(),
  price_month_usd: z.number().optional(),
  price_usd: z.number().optional(), // For Nebius data
  raw_cost: z.string().optional(),
  billing_notes: z.string().optional(),

  // Flags
  spot: z.boolean().optional(),
  class: z.enum(["GPU", "CPU", "service"]).optional(),
  network: z.enum(["InfiniBand", "Ethernet", "Unknown"]).optional(),
  type: z.enum(["VM", "Bare Metal"]).optional(),

  // Computed fields
  percentile: z.number().optional(),
});

export type CpuColumnSchema = z.infer<typeof cpuColumnSchema>;

// CPU pricing filter schema
export const cpuColumnFilterSchema = z.object({
  provider: z.enum(["coreweave", "nebius", "hyperstack", "runpod", "lambda", "digitalocean", "oracle", "crusoe"]).optional(),
  cpu_model: z.string().optional(),
  instance_id: z.string().optional(),
  vcpus: z
    .string()
    .transform((val) => val.split(SLIDER_DELIMITER))
    .pipe(z.coerce.number().array().max(2))
    .optional(),
  system_ram_gb: z
    .string()
    .transform((val) => val.split(SLIDER_DELIMITER))
    .pipe(z.coerce.number().array().max(2))
    .optional(),
  price_hour_usd: z
    .string()
    .transform((val) => val.split(SLIDER_DELIMITER))
    .pipe(z.coerce.number().array().max(2))
    .optional(),
  observed_at: z
    .string()
    .transform((val) => val.split(RANGE_DELIMITER).map(Number))
    .pipe(z.coerce.date().array())
    .optional(),
  class: z.enum(["GPU", "CPU", "service"]).optional(),
  network: z.enum(["InfiniBand", "Ethernet", "Unknown"]).optional(),
  type: z.enum(["VM", "Bare Metal"]).optional(),
});

export type CpuColumnFilterSchema = z.infer<typeof cpuColumnFilterSchema>;


export const cpuFacetMetadataSchema = z.object({
  rows: z.array(z.object({ value: z.any(), total: z.number() })),
  total: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export type CpuFacetMetadataSchema = z.infer<typeof cpuFacetMetadataSchema>;
