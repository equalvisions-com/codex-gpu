"use client";

import * as React from "react";
import type {
  ColumnFiltersState,
  OnChangeFn,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import { useQueryStates } from "nuqs";
import { modelsSearchParamsParser } from "../models-search-params";
import type { DataTableFilterField } from "@/components/data-table/types";
import type { ModalitiesDirection } from "../modalities-filter";

interface ModelsTableSearchState {
  search: ReturnType<typeof useQueryStates<typeof modelsSearchParamsParser>>[0];
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  rowSelection: RowSelectionState;
  handleColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  handleSortingChange: OnChangeFn<SortingState>;
  handleRowSelectionChange: OnChangeFn<RowSelectionState>;
}

export function useModelsTableSearchState(
  filterFields: DataTableFilterField<Record<string, unknown>>[],
): ModelsTableSearchState {
  const [search, setSearch] = useQueryStates(modelsSearchParamsParser);

  const { sort, uuid, search: globalSearch, ...filter } = search;

  const columnFilters = React.useMemo<ColumnFiltersState>(() => {
    const baseFilters = Object.entries(filter)
      .map(([key, value]) => ({
        id: key,
        value: value as unknown,
      }))
      .filter(({ value }) => value ?? undefined) as ColumnFiltersState;

    if (typeof globalSearch === "string" && globalSearch.trim().length) {
      baseFilters.push({ id: "search", value: globalSearch });
    }

    return baseFilters;
  }, [filter, globalSearch]);

  const sorting = React.useMemo<SortingState>(() => {
    return sort ? [sort] : [];
  }, [sort]);

  const rowSelection = React.useMemo<RowSelectionState>(() => {
    return search.uuid ? { [search.uuid]: true } : {};
  }, [search.uuid]);

  const previousFilterPayloadRef = React.useRef<Record<string, unknown> | null>(
    null,
  );
  const handleColumnFiltersChange = React.useCallback<
    OnChangeFn<ColumnFiltersState>
  >(
    (updater) => {
      const nextFilters =
        typeof updater === "function" ? updater(columnFilters) : updater ?? [];
      const searchPayload: Record<string, unknown> = {};

      filterFields.forEach((field) => {
        if (field.value === "modalities") {
          const modalitiesFilter = nextFilters.find(
            (filter) => filter.id === field.value,
          );
          const modalityValue = modalitiesFilter?.value as string[] | undefined;
          const values = modalityValue ?? [];

          const directionsFilter = nextFilters.find(
            (filter) => filter.id === "modalityDirections",
          );
          const directionsValue = directionsFilter?.value as Record<
            string,
            ModalitiesDirection
          > | undefined;
          const directionEntries = directionsValue
            ? Object.entries(directionsValue)
                .map(([key, dir]) => `${key}:${dir}`)
                .sort()
            : [];

          searchPayload[field.value as string] = values.length ? values : null;
          searchPayload.modalityDirections =
            values.length && directionEntries.length ? directionEntries : null;
          return;
        }

        const columnFilter = nextFilters.find(
          (filter) => filter.id === field.value,
        );
        searchPayload[field.value as string] = columnFilter
          ? columnFilter.value
          : null;
      });

      if (
        previousFilterPayloadRef.current &&
        areSearchPayloadsEqual(previousFilterPayloadRef.current, searchPayload)
      ) {
        return;
      }

      previousFilterPayloadRef.current = searchPayload;
      setSearch(searchPayload);
    },
    [columnFilters, filterFields, setSearch],
  );

  const previousSortParamRef = React.useRef<string>("__init__");
  const handleSortingChange = React.useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      const nextSorting =
        typeof updater === "function" ? updater(sorting) : updater ?? [];
      const sortEntry = nextSorting[0] ?? null;
      const serialized =
        sortEntry === null
          ? "null"
          : `${sortEntry.id}:${sortEntry.desc ? "desc" : "asc"}`;
      if (previousSortParamRef.current === serialized) {
        return;
      }
      previousSortParamRef.current = serialized;
      setSearch({ sort: sortEntry ?? null });
    },
    [setSearch, sorting],
  );

  const previousUuidRef = React.useRef<string>("__init__");
  const handleRowSelectionChange = React.useCallback<OnChangeFn<RowSelectionState>>(
    (updater) => {
      const nextSelection =
        typeof updater === "function" ? updater(rowSelection) : updater ?? {};
      const selectedKeys = Object.keys(nextSelection ?? {});
      const nextUuid = selectedKeys[0] ?? null;
      const serializedUuid = nextUuid ?? "null";
      if (previousUuidRef.current === serializedUuid) {
        return;
      }
      previousUuidRef.current = serializedUuid;
      setSearch({ uuid: nextUuid });
    },
    [rowSelection, setSearch],
  );

  return {
    search,
    columnFilters,
    sorting,
    rowSelection,
    handleColumnFiltersChange,
    handleSortingChange,
    handleRowSelectionChange,
  };
}

function areSearchPayloadsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
) {
  const aEntries = Object.entries(a ?? {}).filter(
    ([_, value]) => value !== undefined,
  );
  const bEntries = Object.entries(b ?? {}).filter(
    ([_, value]) => value !== undefined,
  );
  if (aEntries.length !== bEntries.length) return false;
  return aEntries.every(([key, value]) => {
    const other = b[key];
    if (Array.isArray(value) && Array.isArray(other)) {
      if (value.length !== other.length) return false;
      return value.every(
        (val, index) => JSON.stringify(val) === JSON.stringify(other[index]),
      );
    }
    return JSON.stringify(value) === JSON.stringify(other);
  });
}
