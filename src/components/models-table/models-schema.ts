import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@/lib/delimiters";
import { z } from "zod";

// AI Models schema
export const modelsColumnSchema = z.object({
  // Unique identifier for table operations
  id: z.string(),

  // Core identification
  slug: z.string(),
  provider: z.string(),
  name: z.string().nullable(),
  shortName: z.string().nullable(),
  description: z.string().nullable(),

  // Model metadata
  modelVersionGroupId: z.string().nullable(),
  contextLength: z.number().nullable(),
  inputModalities: z.array(z.string()),
  outputModalities: z.array(z.string()),
  hasTextOutput: z.string(),
  group: z.string().nullable(),
  instructType: z.string().nullable(),
  permaslug: z.string().nullable(),

  // Pricing data
  pricing: z.record(z.any()),

  // Metadata
  scrapedAt: z.string(),
});

export type ModelsColumnSchema = z.infer<typeof modelsColumnSchema>;

// AI Models filter schema
export const modelsColumnFilterSchema = z.object({
  provider: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  group: z.string().optional(),
  inputModalities: z.array(z.string()).optional(),
  search: z.string().optional(),
});

export type ModelsColumnFilterSchema = z.infer<typeof modelsColumnFilterSchema>;

export const modelsFacetMetadataSchema = z.object({
  rows: z.array(z.object({ value: z.any(), total: z.number() })),
  total: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export type ModelsFacetMetadataSchema = z.infer<typeof modelsFacetMetadataSchema>;
