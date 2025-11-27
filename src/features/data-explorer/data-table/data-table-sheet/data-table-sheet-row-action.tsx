import { DropdownMenu } from "@/components/ui/dropdown-menu";

import { DropdownMenuContent } from "@/components/ui/dropdown-menu";

import {
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  Equal,
  Search,
} from "lucide-react";
import { CalendarDays } from "lucide-react";
import { startOfDay } from "date-fns";
import { startOfHour } from "date-fns";
import { endOfDay } from "date-fns";
import { Table } from "@tanstack/react-table";
import { CalendarClock } from "lucide-react";
import { endOfHour } from "date-fns";
import { cn } from "@/lib/utils";
import { DataTableFilterField } from "../types";
import { useDataTable } from "../data-table-provider";

interface DataTableSheetRowActionProps<
  TData,
  TFields extends DataTableFilterField<TData>
> extends React.ComponentPropsWithRef<typeof DropdownMenuTrigger> {
  fieldValue: TFields["value"];
  filterFields: TFields[];
  value: string | number;
  table: Table<TData>;
}

export function DataTableSheetRowAction<
  TData,
  TFields extends DataTableFilterField<TData>
>({
  fieldValue,
  filterFields,
  value,
  children,
  className,
  table,
  onKeyDown,
  ...props
}: DataTableSheetRowActionProps<TData, TFields>) {
  const field = filterFields.find((field) => field.value === fieldValue);
  const column = table.getColumn(fieldValue.toString());
  const { columnFilters, setColumnFilters } = useDataTable<TData, unknown>();

  if (!field || !column) return null;

  // Helper function to update filters using controlled state (TanStack Table best practice for manual filtering)
  const updateFilter = (newValue: unknown) => {
    const filterId = String(fieldValue);
    const existingFilter = columnFilters.find((f) => f.id === filterId);
    
    if (newValue === undefined || newValue === null) {
      // Remove filter if value is null/undefined
      setColumnFilters(columnFilters.filter((f) => f.id !== filterId));
      return;
    }

    if (existingFilter) {
      // Update existing filter
      setColumnFilters(
        columnFilters.map((f) =>
          f.id === filterId ? { ...f, value: newValue } : f
        )
      );
    } else {
      // Add new filter
      setColumnFilters([...columnFilters, { id: filterId, value: newValue }]);
    }
  };

  function renderOptions() {
    if (!field) return null;
    switch (field.type) {
      case "checkbox":
        return (
          <DropdownMenuItem
            onClick={() => {
              // Use controlled state instead of column API (TanStack Table best practice for manual filtering)
              const filterValue = columnFilters.find((f) => f.id === String(fieldValue))?.value as
                | undefined
                | Array<unknown>;
              const currentValues = Array.isArray(filterValue) ? filterValue : [];
              const newValue = currentValues.includes(value)
                ? currentValues.filter((v) => v !== value)
                : [...currentValues, value];

              updateFilter(newValue.length > 0 ? newValue : undefined);
            }}
          >
            <Search />
            Include
          </DropdownMenuItem>
        );
      case "input":
        return (
          <DropdownMenuItem onClick={() => updateFilter(value)}>
            <Search />
            Include
          </DropdownMenuItem>
        );
      case "slider":
        return (
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => updateFilter([0, value])}
            >
              {/* FIXME: change icon as it is not clear */}
              <ChevronLeft />
              Less or equal than
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateFilter([value, 5000])}
            >
              {/* FIXME: change icon as it is not clear */}
              <ChevronRight />
              Greater or equal than
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateFilter([value])}>
              <Equal />
              Equal to
            </DropdownMenuItem>
          </DropdownMenuGroup>
        );
      case "timerange":
        const date = new Date(value);
        return (
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => updateFilter([date])}>
              <CalendarSearch />
              Exact timestamp
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const start = startOfHour(date);
                const end = endOfHour(date);
                updateFilter([start, end]);
              }}
            >
              <CalendarClock />
              Same hour
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const start = startOfDay(date);
                const end = endOfDay(date);
                updateFilter([start, end]);
              }}
            >
              <CalendarDays />
              Same day
            </DropdownMenuItem>
          </DropdownMenuGroup>
        );
      default:
        return null;
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            // REMINDER: default behavior is to open the dropdown menu
            // But because we use it to navigate between rows, we need to prevent it
            // and only use "Enter" to select the option
            e.preventDefault();
          }
          onKeyDown?.(e);
        }}
        {...props}
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="left">
        {renderOptions()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
