"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EllipsisVertical } from "lucide-react";
import { DataTableFilterControls } from "@/features/data-explorer/data-table/data-table-filter-controls";
import type { DataTableFilterField } from "@/features/data-explorer/data-table/types";

interface SidebarSkeletonProps {
  filterFields: DataTableFilterField<any>[];
  showSearch?: boolean;
  currentPage?: "gpus" | "llms" | "tools";
}

export function SidebarSkeleton({ 
  filterFields, 
  showSearch = true,
  currentPage = "gpus"
}: SidebarSkeletonProps) {

  return (
    <div className="hidden sm:flex h-[calc(100dvh-var(--total-padding-mobile))] sm:h-[100dvh] flex-col sticky top-0 self-start min-w-72 max-w-72 rounded-lg overflow-hidden">
      <div className="flex h-full w-full flex-col">
        {/* Top section: Navigation + Search */}
        <div className="mx-auto w-full max-w-full p-4 border-b border-border mb-4 space-y-4">
          <div className="flex items-center gap-2">
            {/* Navigation Select Skeleton - Fixed width 212px to match actual select */}
            <Skeleton className="h-9 w-[212px] rounded-lg" />
            {/* Search Button Skeleton - Always shown, matches actual button: h-9 w-9 */}
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          </div>
          {/* Mobile Search Skeleton (hidden on desktop) */}
          {showSearch ? (
            <div className="flex items-center gap-2 sm:hidden">
              <Skeleton className="h-9 flex-1 rounded-lg" />
            </div>
          ) : null}
        </div>

        {/* Middle section: Filter Controls - Use actual component for exact match */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="mx-auto w-full max-w-full px-4 pb-4">
            <DataTableFilterControls showSearch={false} />
          </div>
        </div>

        {/* Bottom section: User Menu Skeleton - Match actual UserMenu structure */}
        <div className="flex-shrink-0 p-4 border-t border-border">
          <div className="flex items-center gap-3 rounded-md p-0 w-full">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex flex-1 flex-col gap-1 min-w-0">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-3 w-36 rounded-md" />
            </div>
            <EllipsisVertical className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}

