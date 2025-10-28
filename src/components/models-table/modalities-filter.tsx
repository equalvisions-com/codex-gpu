"use client";

import * as React from "react";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ModelsColumnSchema } from "./models-schema";
import { ArrowLeftRight } from "lucide-react";
import { CheckboxListSkeleton } from "@/components/data-table/data-table-filter-skeletons";

export type ModalitiesDirection = "input" | "output";

const directionLabels: Record<ModalitiesDirection, string> = {
  input: "Input",
  output: "Output",
};

const modalitySortOrder = ["text", "file", "image", "audio", "video"] as const;
const modalityRank = new Map<string, number>(
  modalitySortOrder.map((value, index) => [value, index]),
);

const getModalityRank = (label: string) =>
  modalityRank.get(label.toLowerCase()) ?? modalityRank.size;

const cycleDirection = (current: ModalitiesDirection): ModalitiesDirection => {
  switch (current) {
    case "input":
      return "output";
    default:
      return "input";
  }
};

export function ModalitiesFilter() {
  const {
    table,
    columnFilters,
    setColumnFilters,
    isLoading,
    getFacetedUniqueValues,
  } = useDataTable<ModelsColumnSchema, unknown>();

  const modalitiesFilter = columnFilters.find((filter) => filter.id === "modalities");
  const directionFilter = columnFilters.find((filter) => filter.id === "modalityDirections");
  const selectedValues = (modalitiesFilter?.value as string[] | undefined) ?? [];
  const directionMap = (directionFilter?.value as Record<string, ModalitiesDirection> | undefined) ?? {};

  const facetedValues = getFacetedUniqueValues?.(table, "modalities");
  const filterOptions = React.useMemo(() => {
    if (!facetedValues) return [] as Array<{ label: string; value: string; total: number }>;

    return Array.from(facetedValues.entries())
      .map(([value, total]) => ({
        label: String(value),
        value: String(value),
        total: Number(total),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [facetedValues]);

  const optionsWithSelections = React.useMemo(() => {
    const base = [...filterOptions];
    const missingSelections = selectedValues.filter(
      (value) => !base.some((option) => option.value === value),
    );

    const extras = missingSelections.map((value) => ({
      label: value,
      value,
      total: 0,
    }));

    return [...base, ...extras].sort((a, b) => {
      const rankDifference = getModalityRank(a.label) - getModalityRank(b.label);
      if (rankDifference !== 0) return rankDifference;
      return a.label.localeCompare(b.label);
    });
  }, [filterOptions, selectedValues]);

  const updateFilters = React.useCallback(
    (nextValues: string[], nextDirections: Record<string, ModalitiesDirection>) => {
      const uniqueValues = Array.from(new Set(nextValues.filter(Boolean)));
      const remainingFilters = columnFilters.filter(
        (filter) => filter.id !== "modalities" && filter.id !== "modalityDirections",
      );

      if (!uniqueValues.length) {
        setColumnFilters(remainingFilters);
        return;
      }

      const normalizedDirections = Object.fromEntries(
        Object.entries(nextDirections).filter(([, direction]) => direction !== "input"),
      );

      const nextFilters = [
        ...remainingFilters,
        {
          id: "modalities",
          value: uniqueValues,
        },
      ];

      if (Object.keys(normalizedDirections).length) {
        nextFilters.push({ id: "modalityDirections", value: normalizedDirections });
      }

      setColumnFilters(nextFilters);
    },
    [columnFilters, setColumnFilters],
  );

  const toggleValue = React.useCallback(
    (optionValue: string) => {
      const isSelected = selectedValues.includes(optionValue);
      const nextValues = isSelected
        ? selectedValues.filter((value) => value !== optionValue)
        : [...selectedValues, optionValue];

      const nextDirections = { ...directionMap };
      if (isSelected) {
        delete nextDirections[optionValue];
      }

      updateFilters(nextValues, nextDirections);
    },
    [directionMap, selectedValues, updateFilters],
  );

  if (!optionsWithSelections.length) {
    return <CheckboxListSkeleton />;
  }

  return (
    <div className="grid gap-2">
      <ScrollArea className="max-h-[168px] rounded-lg">
        <div className="pr-3 space-y-2">
          {optionsWithSelections.map((option) => {
            const checked = selectedValues.includes(option.value);
            const label = option.label.charAt(0).toUpperCase() + option.label.slice(1);
            const optionDirection = directionMap[option.value] ?? "input";

            return (
              <div
                key={option.value}
                className={cn(
                  "group relative flex w-full items-center gap-1 rounded-md px-2 py-2 text-left hover:bg-muted",
                  checked && "bg-muted",
                )}
              >
                <button
                  type="button"
                  className="flex flex-1 items-center justify-between"
                  onClick={() => toggleValue(option.value)}
                >
                  <span className="truncate font-normal text-foreground group-hover:text-accent-foreground">
                    {label}
                    {checked ? (
                      <span className="text-foreground/70">{` / ${directionLabels[optionDirection]}`}</span>
                    ) : null}
                  </span>
                </button>
                {checked ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      const nextDirection = cycleDirection(optionDirection);
                      const nextDirections = { ...directionMap };
                      if (nextDirection === "input") {
                        delete nextDirections[option.value];
                      } else {
                        nextDirections[option.value] = nextDirection;
                      }
                      updateFilters(selectedValues, nextDirections);
                    }}
                    aria-label={`Toggle ${label} direction`}
                    className="text-foreground/70"
                  >
                    <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Toggle modality direction</span>
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
