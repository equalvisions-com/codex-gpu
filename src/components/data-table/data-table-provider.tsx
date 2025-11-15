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
  setColumnFilters: Dispatch<SetStateAction<ColumnFiltersState>>;
  setRowSelection: Dispatch<SetStateAction<RowSelectionState>>;
}

interface DataTableBaseContextType<TData = unknown, TValue = unknown> {
  table: Table<TData>;
  filterFields: DataTableFilterField<TData>[];
  columns: ColumnDef<TData, TValue>[];
  isLoading?: boolean;
  getFacetedUniqueValues?: (
    table: Table<TData>,
    columnId: string,
  ) => Map<string, number> | undefined;
  getFacetedMinMaxValues?: (
    table: Table<TData>,
    columnId: string,
  ) => undefined | [number, number];
}

interface DataTableContextType<TData = unknown, TValue = unknown>
  extends DataTableStateContextType,
    DataTableBaseContextType<TData, TValue> {}

const DataTableContext = createContext<DataTableContextType<
  any,
  any
> | null>(null);

const noopSetCheckedRows: Dispatch<SetStateAction<Record<string, boolean>>> = () => {};
const noopSetColumnFilters: Dispatch<SetStateAction<ColumnFiltersState>> = () => {};
const noopSetRowSelection: Dispatch<SetStateAction<RowSelectionState>> = () => {};

export function DataTableProvider<TData, TValue>({
  children,
  ...props
}: Partial<DataTableStateContextType> &
  DataTableBaseContextType<TData, TValue> & {
    children: React.ReactNode;
  }) {
  const {
    table,
    filterFields,
    columns,
    isLoading,
    getFacetedUniqueValues,
    getFacetedMinMaxValues,
    columnFilters = [],
    sorting = [],
    rowSelection = {},
    columnOrder = [],
    pagination = null,
    enableColumnOrdering = false,
    checkedRows = {},
    toggleCheckedRow = () => {},
    setCheckedRows = noopSetCheckedRows,
    setColumnFilters = noopSetColumnFilters,
    setRowSelection = noopSetRowSelection,
  } = props;

  const value = useMemo(
    () => ({
      table,
      filterFields,
      columns,
      isLoading,
      getFacetedUniqueValues,
      getFacetedMinMaxValues,
      columnFilters,
      sorting,
      rowSelection,
      columnOrder,
      pagination,
      enableColumnOrdering,
      checkedRows,
      toggleCheckedRow,
      setCheckedRows,
      setColumnFilters,
      setRowSelection,
    }),
    [
      table,
      filterFields,
      columns,
      isLoading,
      getFacetedUniqueValues,
      getFacetedMinMaxValues,
      columnFilters,
      sorting,
      rowSelection,
      columnOrder,
      pagination,
      enableColumnOrdering,
      checkedRows,
      toggleCheckedRow,
      setCheckedRows,
      setColumnFilters,
      setRowSelection,
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
