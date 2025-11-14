"use client";

import { X } from "lucide-react";
import { Button } from "../ui/button";
import { useDataTable } from "@/components/data-table/data-table-provider";

export function DataTableResetButton() {
  const { table } = useDataTable();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        table.resetColumnFilters();
      }}
      aria-label="Reset filters"
      title="Reset filters"
    >
      <X className="mr-2 h-4 w-4" />
      Reset
    </Button>
  );
}
