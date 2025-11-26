import type { ModelsColumnSchema } from "./models-schema";

export function stableModelKey(
  row: Partial<Pick<ModelsColumnSchema, "id" | "slug" | "provider" | "name">>
): string {
  if (row.id) return row.id;
  const provider = row.provider?.toLowerCase().trim();
  const slug = row.slug?.toLowerCase().trim();
  const name = row.name?.toLowerCase().trim();
  return [provider, slug ?? name].filter(Boolean).join(":");
}
