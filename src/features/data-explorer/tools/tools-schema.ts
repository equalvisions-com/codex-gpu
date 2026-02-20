import { z } from "zod";

// Tools table schema
const toolsColumnSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)),
  name: z.string().nullable(),
  developer: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  price: z.string().nullable(),
  license: z.string().nullable(),
  url: z.string().nullable(),
  stack: z.string().nullable(),
  oss: z.string().nullable(),
  stable_key: z.string().optional(),
});

export type ToolColumnSchema = z.infer<typeof toolsColumnSchema>;

// Filters
const toolsColumnFilterSchema = z.object({
  developer: z.array(z.string()).optional(),
  category: z.array(z.string()).optional(),
  stack: z.array(z.string()).optional(),
  oss: z.array(z.string()).optional(),
  search: z.string().optional(),
});

export type ToolsColumnFilterSchema = z.infer<typeof toolsColumnFilterSchema>;

const toolsFacetMetadataSchema = z.object({
  rows: z.array(z.object({ value: z.any(), total: z.number() })),
  total: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export type ToolsFacetMetadataSchema = z.infer<typeof toolsFacetMetadataSchema>;
