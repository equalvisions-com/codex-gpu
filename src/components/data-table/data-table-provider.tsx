import { DataTableFilterField } from "@/components/data-table/types";
import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
  SortingState,
  Table,
} from "@tanstack/react-table";
import { createContext, useContext, useMemo, type Dispatch, type SetStateAction } from "react";

// REMINDER: read about how to move controlled state out of the useReactTable hook
// https://github.com/TanStack/table/discussions/4005#discussioncomment-7303569

interface DataTableStateContextType {
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  rowSelection: RowSelectionState;
  columnOrder: string[];
  pagination: PaginationState | null;
  enableColumnOrdering: boolean;
  // Independent checkbox state for rows (separate from selection)
  checkedRows: Record<string, boolean>;
  toggleCheckedRow: (rowId: string, next?: boolean) => void;
  setCheckedRows: Dispatch<SetStateAction<Record<string, boolean>>>;
  setColumnFilters: (filters: ColumnFiltersState) => void;
  setRowSelection: (selection: RowSelectionState) => void;
}

interface DataTableBaseContextType<TData = unknown, TValue = unknown> {
  table: Table<TData>;
  filterFields: DataTableFilterField<TData>[];
  columns: ColumnDef<TData, TValue>[];
  isLoading?: boolean;
  getFacetedUniqueValues?: (
    table: Table<TData>,
    columnId: string,
  ) => Map<string, number>;
  getFacetedMinMaxValues?: (
    table: Table<TData>,
    columnId: string,
  ) => undefined | [number, number];
}

interface DataTableContextType<TData = unknown, TValue = unknown>
  extends DataTableStateContextType,
    DataTableBaseContextType<TData, TValue> {}

export const DataTableContext = createContext<DataTableContextType<
  any,
  any
> | null>(null);

const noopSetCheckedRows: Dispatch<SetStateAction<Record<string, boolean>>> = () => {};

export function DataTableProvider<TData, TValue>({
  children,
  ...props
}: Partial<DataTableStateContextType> &
  DataTableBaseContextType<TData, TValue> & {
    children: React.ReactNode;
  }) {
  const value = useMemo(
    () => ({
      ...props,
      columnFilters: props.columnFilters ?? [],
      sorting: props.sorting ?? [],
      rowSelection: props.rowSelection ?? {},
      columnOrder: props.columnOrder ?? [],
      pagination: props.pagination ?? null,
      enableColumnOrdering: props.enableColumnOrdering ?? false,
      checkedRows: props.checkedRows ?? {},
      toggleCheckedRow: props.toggleCheckedRow ?? (() => {}),
      setCheckedRows: props.setCheckedRows ?? noopSetCheckedRows,
      setColumnFilters: props.setColumnFilters ?? (() => {}),
      setRowSelection: props.setRowSelection ?? (() => {}),
    }),
    [
      props.columnFilters,
      props.sorting,
      props.rowSelection,
      props.columnOrder,
      props.pagination,
      props.table,
      props.filterFields,
      props.columns,
      props.enableColumnOrdering,
      props.isLoading,
      props.getFacetedUniqueValues,
      props.getFacetedMinMaxValues,
      props.checkedRows,
      props.toggleCheckedRow,
      props.setCheckedRows,
      props.setColumnFilters,
      props.setRowSelection,
    ],
  );

  return (
    <DataTableContext.Provider value={value}>
      {children}
    </DataTableContext.Provider>
  );
}

export function useDataTable<TData, TValue>() {
  const context = useContext(DataTableContext);

  if (!context) {
    throw new Error("useDataTable must be used within a DataTableProvider");
  }

  return context as DataTableContextType<TData, TValue>;
}
