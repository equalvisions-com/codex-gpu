"use client";

import { X } from "lucide-react";
import { Button } from "../ui/button";
import { Kbd } from "@/components/custom/kbd";
import { useHotKey } from "@/hooks/use-hot-key";
import { useDataTable } from "@/components/data-table/data-table-provider";

export function DataTableResetButton() {
  const { table, resetSearch } = useDataTable();
  useHotKey(() => {
    table.resetColumnFilters();
    resetSearch?.();
  }, "Escape");

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        table.resetColumnFilters();
        resetSearch?.();
      }}
      aria-label="Reset filters (Cmd+Esc)"
      title="Reset filters (Cmd+Esc)"
    >
      <X className="mr-2 h-4 w-4" />
      Reset
    </Button>
  );
}
