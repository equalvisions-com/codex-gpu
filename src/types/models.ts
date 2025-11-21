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
  endpointId?: string | null;
  throughput?: number | null;
  maxCompletionTokens?: number | null;
  supportedParameters: string[];
  modalityScore?: number | null;

  // Complex nested data
  pricing: Record<string, any>;
  features: Record<string, any>;
  promptPrice?: number | null;
  completionPrice?: number | null;

  // Metadata
  provider: string;
  scrapedAt: string;
}

export interface ModelScrapeResult {
  models: AIModel[];
  scrapedAt: string;
  sourceHash: string;
}
