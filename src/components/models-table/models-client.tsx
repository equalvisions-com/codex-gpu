"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
import { modelsColumns } from "./models-columns";
import { modelsDataOptions } from "./models-query-options";
import { modelsSearchParamsParser } from "./models-search-params";
import { ModelsDataTableInfinite } from "./models-data-table-infinite";
import type { ModelsColumnSchema } from "./models-schema";

interface ModelsClientProps {
  initialFavoriteKeys?: string[];
}

export function ModelsClient({ initialFavoriteKeys }: ModelsClientProps) {
  const [search, setSearch] = useQueryStates(modelsSearchParamsParser);

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const filters = [];
    if (search.provider) filters.push({ id: "provider", value: search.provider });
    if (search.group) filters.push({ id: "group", value: search.group });
    if (search.inputModalities?.length) filters.push({ id: "inputModalities", value: search.inputModalities });
    if (search.search) filters.push({ id: "search", value: search.search });
    if (search.name) filters.push({ id: "name", value: search.name });
    if (search.description) filters.push({ id: "description", value: search.description });
    return filters;
  });

  const [sorting, setSorting] = useState(() => {
    if (search.sort) {
      return [{ id: search.sort.id, desc: search.sort.desc }];
    }
    return [];
  });

  const [rowSelection, setRowSelection] = useState(() => {
    if (search.uuid) {
      return { [search.uuid]: true };
    }
    return {};
  });

  const query = useInfiniteQuery(modelsDataOptions(search));

  const data = useMemo(() => {
    return query.data?.pages.flatMap((page) => page.data) ?? [];
  }, [query.data]);

  const totalRows = query.data?.pages[0]?.meta.totalRowCount ?? 0;
  const filterRows = query.data?.pages[0]?.meta.filterRowCount ?? 0;
  const totalRowsFetched = data.length;

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
      totalRows={totalRows}
      filterRows={filterRows}
      totalRowsFetched={totalRowsFetched}
      meta={{ initialFavoriteKeys }}
      isFetching={query.isFetching}
      isLoading={query.isLoading}
      isFetchingNextPage={query.isFetchingNextPage}
      hasNextPage={query.hasNextPage}
      fetchNextPage={query.fetchNextPage}
      renderSheetTitle={renderSheetTitle}
      searchParamsParser={modelsSearchParamsParser}
      search={search.search || undefined}
      getRowId={(row) => row.id}
    />
  );
}
