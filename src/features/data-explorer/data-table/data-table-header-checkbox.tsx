"use client";

import * as React from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { Checkbox } from "@/components/ui/checkbox";
import { useDataTable } from "./data-table-provider";

export function DataTableHeaderCheckbox() {
  const { table, checkedRows, setCheckedRows } = useDataTable<any, unknown>();

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
    (_state: CheckedState) => {
      const shouldCheck = !(allChecked || someChecked);
      setCheckedRows((previous) => {
        const nextState = { ...previous };
        if (shouldCheck) {
          for (const id of rowIds) {
            nextState[id] = true;
          }
        } else {
          for (const id of rowIds) {
            delete nextState[id];
          }
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
