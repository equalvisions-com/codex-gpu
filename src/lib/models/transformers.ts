import type { AIModel } from "@/types/models";
import type { ModelsColumnSchema } from "@/components/models-table/models-schema";

export function toModelsColumnRow(model: AIModel): ModelsColumnSchema {
  return {
    id: model.id,
    slug: model.slug,
    provider: model.provider,
    name: model.name ?? null,
    shortName: model.shortName ?? null,
    author: model.author ?? null,
    description: model.description ?? null,
    modelVersionGroupId: model.modelVersionGroupId ?? null,
    contextLength: model.contextLength ?? null,
    inputModalities: model.inputModalities ?? [],
    outputModalities: model.outputModalities ?? [],
    hasTextOutput: model.hasTextOutput ?? "false",
    group: model.group ?? null,
    instructType: model.instructType ?? null,
    permaslug: model.permaslug ?? null,
    pricing: model.pricing ?? {},
    features: model.features ?? {},
    endpoint: model.endpoint ?? {},
    mmlu: model.mmlu ?? null,
    scrapedAt: model.scrapedAt,
  };
}
