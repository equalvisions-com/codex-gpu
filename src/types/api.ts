import type { ColumnSchema } from "@/features/data-explorer/table/schema";

export type RowWithId = ColumnSchema & { uuid: string };
