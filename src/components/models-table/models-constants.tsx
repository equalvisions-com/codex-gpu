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
    label: "Provider",
    value: "provider",
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
];