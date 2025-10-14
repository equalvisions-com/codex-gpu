"use client";

import type {
  DataTableFilterField,
  Option,
  SheetField,
} from "@/components/data-table/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { ModelsColumnSchema } from "./models-schema";

// Models filter fields
export const filterFields: DataTableFilterField<ModelsColumnSchema>[] = [
  {
    label: "Labs",
    value: "author",
    type: "checkbox",
    defaultOpen: true,
  },
  {
    label: "Provider",
    value: "provider",
    type: "checkbox",
    defaultOpen: true,
  },
  {
    label: "Context Length",
    value: "contextLength",
    type: "slider",
    min: 1024,
    max: 200000,
    defaultOpen: true,
  },
  {
    label: "Output Modalities",
    value: "outputModalities",
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
    id: "inputModalities",
    label: "Input Modalities",
    type: "readonly",
  },
  {
    id: "outputModalities",
    label: "Output Modalities",
    type: "readonly",
  },
];