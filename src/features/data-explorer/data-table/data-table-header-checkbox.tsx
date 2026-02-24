"use client";

import * as React from "react";
import type { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Checkbox } from "@/components/ui/checkbox";
import { useDataTable } from "./data-table-provider";

export function DataTableHeaderCheckbox() {
  "use no memo";
  // Opt out of React Compiler — `table` is a stable reference (TanStack Table
  // mutates internally), so the compiler incorrectly caches method-call results
  // like `table.getRowModel().rows` across renders, returning stale empty rows.
  const { table, checkedRows, setCheckedRows } = useDataTable<unknown, unknown>();

  const rows = table.getRowModel().rows;
  const rowIds = React.useMemo(() => rows.map((row) => row.id), [rows]);

  const checkedCount = React.useMemo(() => {
    let count = 0;
    for (const id of rowIds) {
      if (checkedRows[id]) count += 1;
    }
    return count;
  }, [rowIds, checkedRows]);

  const allChecked = rowIds.length > 0 && checkedCount === rowIds.length;
  const someChecked = checkedCount > 0 && checkedCount < rowIds.length;

  const handleToggle = React.useCallback(
    (_state: CheckboxPrimitive.CheckedState) => {
      const shouldCheck = !(allChecked || someChecked);
      setCheckedRows((previous) => {
        // When unchecking, clear ALL checked rows (not just visible ones)
        // This fixes the virtualization bug where scrolled-out rows weren't being unselected
        if (!shouldCheck) {
          return {};
        }
        // When checking, add all visible rows
        const nextState = { ...previous };
        for (const id of rowIds) {
          nextState[id] = true;
        }
        return nextState;
      });
    },
    [allChecked, someChecked, rowIds, setCheckedRows],
  );

  return (
    <Checkbox
      aria-label={allChecked ? "Unselect all rows" : "Select all rows"}
      className="h-4 w-4 shadow-sm transition-shadow"
      disabled={rowIds.length === 0}
      checked={allChecked ? true : someChecked ? "indeterminate" : false}
      onCheckedChange={handleToggle}
    />
  );
}
