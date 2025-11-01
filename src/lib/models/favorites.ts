import type { ModelsColumnSchema } from "@/components/models-table/models-schema";
import { stableModelKey } from "@/components/models-table/stable-key";
import { modelsCache } from "@/lib/models-cache";
import { toModelsColumnRow } from "@/lib/models/transformers";

export async function getFavoriteModelRows(keys: string[]): Promise<ModelsColumnSchema[]> {
  if (keys.length === 0) {
    return [];
  }

  const uniqueKeys = Array.from(new Set(keys));
  const models = await modelsCache.getModelsByIds(uniqueKeys);
  if (!models.length) {
    return [];
  }

  const rowsByKey = new Map<string, ModelsColumnSchema>();
  for (const model of models) {
    const row = toModelsColumnRow(model);
    rowsByKey.set(row.id, row);
    rowsByKey.set(stableModelKey(row), row);
  }

  return keys
    .map((key) => rowsByKey.get(key) ?? null)
    .filter((row): row is ModelsColumnSchema => Boolean(row));
}
