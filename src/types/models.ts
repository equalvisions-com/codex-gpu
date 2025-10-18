// AI Models types
export interface AIModel {
  id: string;
  slug: string;
  name?: string;
  shortName?: string;
  author?: string;
  description?: string;
  modelVersionGroupId?: string | null;
  contextLength?: number;
  inputModalities: string[];
  outputModalities: string[];
  hasTextOutput: string; // boolean as string for JSON compatibility
  group?: string;
  instructType?: string | null;
  permaslug?: string;
  mmlu?: number | null;

  // Complex nested data
  pricing: Record<string, any>;
  features: Record<string, any>;
  endpoint: Record<string, any>;

  // Metadata
  provider: string;
  scrapedAt: string;
}

export interface ModelSnapshot {
  provider: string;
  version: number;
  last_updated: string;
  models: AIModel[];
}

export interface ModelScrapeResult {
  models: AIModel[];
  scrapedAt: string;
  sourceHash: string;
}
