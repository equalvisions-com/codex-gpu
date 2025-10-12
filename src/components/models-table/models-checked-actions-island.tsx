"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { Button } from "@/components/ui/button";
import { GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModelsColumnSchema } from "./models-schema";

export function ModelsCheckedActionsIsland({ initialFavoriteKeys }: { initialFavoriteKeys?: string[] }) {
  const { checkedRows, toggleCheckedRow } = useDataTable<ModelsColumnSchema, unknown>();

  // Only show island when there are checked rows
  const hasSelection = React.useMemo(() => {
    for (const _ in checkedRows) return true;
    return false;
  }, [checkedRows]);

  if (!hasSelection) return null;

  const handleCompare = () => {
    const url = new URL(window.location.href);
    const checkedRowIds = Object.keys(checkedRows);
    url.searchParams.set("compare", checkedRowIds.join(","));
    window.open(url.toString(), "_blank");
  };

  const checkedCount = Object.keys(checkedRows).length;

  // Calculate position for the floating island
  const container = document.querySelector('[data-table-container]');
  if (!container) return null;

  const rect = container.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;

  return createPortal(
    <div
      className={cn(
        "fixed z-50 flex items-center gap-2 rounded-lg border bg-background p-3 shadow-lg transition-all duration-200",
        "left-1/2 top-0 -translate-x-1/2 -translate-y-full",
      )}
      style={{
        top: rect.top + scrollTop - 16,
      }}
    >
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span>{checkedCount} selected</span>
      </div>

      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={handleCompare} className="gap-1.5">
          <GitCompare className="h-3.5 w-3.5" />
          Compare
        </Button>
      </div>
    </div>,
    document.body,
  );
}
