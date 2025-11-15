import type { ColumnSchema } from "@/components/infinite-table/schema";

export type RowWithId = ColumnSchema & { uuid: string };
