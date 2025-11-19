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
    permaslug: model.permaslug ?? null,
    endpointId: model.endpointId ?? null,
    promptPrice: model.promptPrice ?? null,
    completionPrice: model.completionPrice ?? null,
    modalityScore: model.modalityScore ?? null,
    mmlu: model.mmlu ?? null,
    maxCompletionTokens: model.maxCompletionTokens ?? null,
    supportedParameters: Array.isArray(model.supportedParameters)
      ? model.supportedParameters
      : [],
    scrapedAt: model.scrapedAt,
  };
}
