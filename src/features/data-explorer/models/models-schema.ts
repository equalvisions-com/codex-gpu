import { z } from "zod";

// AI Models schema
const modelsColumnSchema = z.object({
  // Unique identifier for table operations
  id: z.string(),

  // Core identification
  slug: z.string(),
  provider: z.string(),
  name: z.string().nullable(),
  shortName: z.string().nullable(),
  author: z.string().nullable(),
  description: z.string().nullable(),

  // Model metadata
  modelVersionGroupId: z.string().nullable(),
  contextLength: z.number().nullable(),
  inputModalities: z.array(z.string()),
  outputModalities: z.array(z.string()),
  permaslug: z.string().nullable(),
  endpointId: z.string().nullable(),
  throughput: z.number().nullable(),
  maxCompletionTokens: z.number().nullable(),
  supportedParameters: z.array(z.string()),
  modalityScore: z.number().nullable(),

  // Pricing data
  promptPrice: z.number().nullable(),
  completionPrice: z.number().nullable(),

  // Metadata
  scrapedAt: z.string(),
});

export type ModelsColumnSchema = z.infer<typeof modelsColumnSchema>;

// AI Models filter schema
const modelsColumnFilterSchema = z.object({
  provider: z.array(z.string()).optional(),
  author: z.array(z.string()).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  modalities: z.array(z.string()).optional(),
  modalityDirections: z
    .record(z.enum(["input", "output"]))
    .optional(),
  contextLength: z.array(z.number()).optional(),
  inputPrice: z.array(z.number()).optional(),
  outputPrice: z.array(z.number()).optional(),
  search: z.string().optional(),
});

type ModelsColumnFilterSchema = z.infer<typeof modelsColumnFilterSchema>;

const modelsFacetMetadataSchema = z.object({
  rows: z.array(z.object({ value: z.any(), total: z.number() })),
  total: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export type ModelsFacetMetadataSchema = z.infer<typeof modelsFacetMetadataSchema>;
