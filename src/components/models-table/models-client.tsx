"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { useMemo, useState, useEffect } from "react";
import { useQueryStates } from "nuqs";
import { modelsColumns } from "./models-columns";
import { modelsDataOptions, modelsFacetsOptions } from "./models-query-options";
import { modelsSearchParamsParser } from "./models-search-params";
import { ModelsDataTableInfinite } from "./models-data-table-infinite";
import { filterFields, sheetFields } from "./models-constants";
import type { ModelsColumnSchema } from "./models-schema";

interface ModelsClientProps {
  initialFavoriteKeys?: string[];
}

export function ModelsClient({ initialFavoriteKeys }: ModelsClientProps) {
  const [search, setSearch] = useQueryStates(modelsSearchParamsParser);
  const queryClient = useQueryClient();

  // Compute initial filters once using useMemo (React best practice for expensive initial state)
  const initialFilters = useMemo(() => {
    const filters = [];
    if (search.provider) filters.push({ id: "provider", value: search.provider });
    if (search.author) filters.push({ id: "author", value: search.author });
    if (search.inputModalities?.length) filters.push({ id: "inputModalities", value: search.inputModalities });
    if (search.outputModalities?.length) filters.push({ id: "outputModalities", value: search.outputModalities });
    if (search.contextLength?.length) filters.push({ id: "contextLength", value: search.contextLength });
    if (search.inputPrice?.length) filters.push({ id: "inputPrice", value: search.inputPrice });
    if (search.outputPrice?.length) filters.push({ id: "outputPrice", value: search.outputPrice });
    if (search.search) filters.push({ id: "search", value: search.search });
    if (search.name) filters.push({ id: "name", value: search.name });
    if (search.description) filters.push({ id: "description", value: search.description });
    return filters;
  }, [search.provider, search.author, search.inputModalities, search.outputModalities, search.contextLength, search.inputPrice, search.outputPrice, search.search, search.name, search.description]);

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialFilters);


  // Compute initial sorting using useMemo (consistent with React best practices)
  const initialSorting = useMemo(() => {
    if (search.sort) {
      return [{ id: search.sort.id, desc: search.sort.desc }];
    }
    return [];
  }, [search.sort]);

  // Compute initial row selection using useMemo (consistent with React best practices)
  const initialRowSelection = useMemo(() => {
    if (search.uuid) {
      return { [search.uuid]: true };
    }
    return {};
  }, [search.uuid]);

  const [sorting, setSorting] = useState(initialSorting);
  const [rowSelection, setRowSelection] = useState(initialRowSelection);

  // Separate queries: data (depends on filters) and facets (independent of filters)
  const dataQuery = useInfiniteQuery(modelsDataOptions(search));
  const facetsQuery = useQuery(modelsFacetsOptions());

  // Scroll to top when sorting changes to prevent stale data flashing
  useEffect(() => {
    if (sorting.length > 0) {
      // Scroll to top when sorting changes to show fresh sorted data
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [sorting]);

  const data = useMemo(() => {
    return dataQuery.data?.pages.flatMap((page) => page.data) ?? [];
  }, [dataQuery.data]);

  // REMINDER: meta data is always the same for all pages as filters do not change(!)
  const lastPage = dataQuery.data?.pages?.[dataQuery.data?.pages.length - 1];
  const totalRows = lastPage?.meta?.totalRowCount ?? 0;
  const filterRows = lastPage?.meta?.filterRowCount ?? 0;
  const totalRowsFetched = data.length;

  // Facets come from separate query (stable, doesn't refetch on filter changes)
  const facets = facetsQuery.data;

  const renderSheetTitle = ({ row }: { row?: any }) => {
    if (!row) return "AI Model Details";
    const model = row.original as ModelsColumnSchema;
    return model.shortName || model.name || "Model Details";
  };

  return (
    <ModelsDataTableInfinite
      columns={modelsColumns}
      data={data}
      columnFilters={columnFilters}
      onColumnFiltersChange={setColumnFilters}
      sorting={sorting}
      onSortingChange={setSorting}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      filterFields={filterFields}
      sheetFields={sheetFields}
      totalRows={totalRows}
      filterRows={filterRows}
      totalRowsFetched={totalRowsFetched}
      meta={{ initialFavoriteKeys, facets }}
      isFetching={dataQuery.isFetching}
      isLoading={dataQuery.isLoading}
      isFetchingNextPage={dataQuery.isFetchingNextPage}
      hasNextPage={dataQuery.hasNextPage}
      fetchNextPage={dataQuery.fetchNextPage}
      renderSheetTitle={renderSheetTitle}
      modelsSearchParamsParser={modelsSearchParamsParser}
      search={search.search || undefined}
      getRowId={(row) => row.id}
    />
  );
}
