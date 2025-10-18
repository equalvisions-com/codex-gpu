"use client";

import type {
  DataTableFilterField,
  SheetField,
} from "@/components/data-table/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { ModelsColumnSchema } from "./models-schema";

// Models filter fields
export const filterFields: DataTableFilterField<ModelsColumnSchema>[] = [
  {
    label: "Search",
    value: "search",
    type: "input",
    defaultOpen: true,
  },
  {
    label: "Labs",
    value: "author",
    type: "checkbox",
    defaultOpen: true,
  },
  {
    label: "Context",
    value: "contextLength",
    type: "slider",
    min: 1000,
    max: 1000000,
    step: 1024,
    defaultOpen: true,
  },
  {
    label: "Prompt",
    value: "inputPrice",
    type: "slider",
    min: 0,
    max: 0.00001,
    defaultOpen: true,
  },
  {
    label: "Modalities",
    value: "modalities",
    type: "checkbox",
    defaultOpen: true,
  },
  {
    label: "Provider",
    value: "provider",
    type: "checkbox",
    defaultOpen: true,
  },
];

// Sheet fields for detailed view
export const sheetFields: SheetField<ModelsColumnSchema>[] = [
  {
    id: "provider",
    label: "Provider",
    type: "readonly",
  },
  {
    id: "name",
    label: "Model Name",
    type: "readonly",
  },
  {
    id: "description",
    label: "Description",
    type: "readonly",
  },
  {
    id: "contextLength",
    label: "Context Length",
    type: "readonly",
  },
  {
    id: "mmlu",
    label: "MMLU-Pro",
    type: "readonly",
    component: (row) => {
      const score = row.mmlu;
      if (score === null || score === undefined) return "Not available";
      return `${(score * 100).toFixed(1)}%`;
    },
  },
  {
    id: "inputModalities",
    label: "Input Modalities",
    type: "readonly",
  },
];
