import { RANGE_DELIMITER, SLIDER_DELIMITER } from "@/lib/delimiters";
import { z } from "zod";

// GPU instance pricing schema
const columnSchema = z.object({
  // Unique identifier for table operations
  uuid: z.string(),
  stable_key: z.string().optional(),

  // Core identification (from PriceRow)
  provider: z.enum(["coreweave", "nebius", "hyperstack", "runpod", "lambda", "digitalocean", "oracle", "crusoe", "flyio", "vultr", "latitude", "ori", "voltagepark", "googlecloud", "verda", "scaleway", "replicate", "thundercompute", "koyeb", "sesterce"]),
  source_url: z.string(),
  observed_at: z.string(),
  item: z.string().optional(), // For Nebius data
  sku: z.string().optional(),

  // Hardware
  gpu_model: z.string().optional(),
  gpu_count: z.number().optional(),
  vram_gb: z.number().optional(),
  vcpus: z.union([z.number(), z.string()]).optional(),
  system_ram_gb: z.number().optional(),

  // Pricing
  price_hour_usd: z.number().optional(),
  price_usd: z.number().optional(), // For Nebius data

  // Flags
  type: z.enum(["VM", "Bare Metal"]).optional(),

});

export type ColumnSchema = z.infer<typeof columnSchema>;

// GPU pricing filter schema
const columnFilterSchema = z.object({
  provider: z
    .enum(["coreweave", "nebius", "hyperstack", "runpod", "lambda", "digitalocean", "oracle", "crusoe", "flyio", "vultr", "latitude", "ori", "voltagepark", "googlecloud", "verda", "scaleway", "replicate", "thundercompute", "koyeb", "sesterce"])
    .optional(),
  gpu_model: z.string().optional(),
  instance_id: z.string().optional(),
  gpu_count: z
    .string()
    .transform((val) => val.split(SLIDER_DELIMITER))
    .pipe(z.coerce.number().array().max(2))
    .optional(),
  vram_gb: z
    .string()
    .transform((val) => val.split(SLIDER_DELIMITER))
    .pipe(z.coerce.number().array().max(2))
    .optional(),
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
  network: z.enum(["InfiniBand", "Ethernet", "Unknown"]).optional(),
  type: z.enum(["VM", "Bare Metal"]).optional(),
});

type ColumnFilterSchema = z.infer<typeof columnFilterSchema>;


const facetMetadataSchema = z.object({
  rows: z.array(z.object({ value: z.any(), total: z.number() })),
  total: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export type FacetMetadataSchema = z.infer<typeof facetMetadataSchema>;
