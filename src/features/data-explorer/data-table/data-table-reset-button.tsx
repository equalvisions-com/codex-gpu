"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDataTable } from "@/features/data-explorer/data-table/data-table-provider";

export function DataTableResetButton() {
  const { table, columnFilters, setColumnFilters } = useDataTable();
  const hasActiveFilters = columnFilters.length > 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        if (!hasActiveFilters) return;
        // Reset both the table state and the externally-controlled filter state
        table.resetColumnFilters();
        setColumnFilters([]);
      }}
      aria-label="Reset filters"
      title="Reset filters"
      className="h-6 w-6"
      disabled={!hasActiveFilters}
    >
      <Trash2 className="h-4 w-4 text-accent-foreground" />
    </Button>
  );
}
