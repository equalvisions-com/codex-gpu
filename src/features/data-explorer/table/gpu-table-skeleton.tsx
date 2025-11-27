import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/custom/table";
import { cn } from "@/lib/utils";

// GPU table column structure matching gpuColumnOrder from constants.tsx
const GPU_COLUMNS = [
  { id: "blank", title: "", width: 45, minWidth: 45, align: "center" },
  { id: "provider", title: "Provider", width: 171, minWidth: 171, align: "left" },
  { id: "gpu_model", title: "Model", width: 275, minWidth: 275, align: "left" },
  { id: "price_hour_usd", title: "Price", width: 150, minWidth: 150, align: "right" },
  { id: "gpu_count", title: "GPUs", width: 150, minWidth: 150, align: "right" },
  { id: "vram_gb", title: "VRAM", width: 150, minWidth: 150, align: "right" },
  { id: "vcpus", title: "vCPUs", width: 150, minWidth: 150, align: "right" },
  { id: "system_ram_gb", title: "RAM", width: 150, minWidth: 150, align: "right" },
  { id: "type", title: "Config", width: 150, minWidth: 150, align: "right" },
];

const SKELETON_ROW_COUNT = 50;
const MINIMUM_MODEL_COLUMN_WIDTH = 275;

export function GpuTableSkeleton() {
  const fixedColumnsWidth = GPU_COLUMNS.filter((col) => col.id !== "gpu_model")
    .reduce((acc, col) => acc + col.width, 0);
  const totalMinWidth = fixedColumnsWidth + MINIMUM_MODEL_COLUMN_WIDTH;

  return (
    <div className="flex flex-col gap-2 sm:gap-4">
      {/* Mobile header skeleton */}
      <div className="sm:hidden w-full px-2 py-2">
        <div className="flex w-full items-center justify-between gap-2">
          <Skeleton className="h-9 w-[102px] rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
      </div>
      
      <div className="grid h-full grid-cols-1 gap-0 sm:grid-cols-[13rem_1fr] md:grid-cols-[18rem_1fr]">
        {/* Sidebar skeleton */}
        <div
          className={cn(
            "hidden sm:flex h-[calc(100dvh-var(--total-padding-mobile))] sm:h-[100dvh] flex-col sticky top-0 self-start min-w-72 max-w-72 rounded-lg overflow-hidden"
          )}
        >
          <div className="flex h-full w-full flex-col">
            <div className="mx-auto w-full max-w-full p-4 border-b border-border mb-4 space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="mx-auto w-full max-w-full px-4 pb-4 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="flex-shrink-0 p-4 border-t border-border">
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>

        {/* Table skeleton */}
        <div
          className={cn(
            "flex max-w-full flex-1 flex-col min-w-0"
          )}
          data-table-container=""
        >
          <div className={cn("z-0 flex flex-col h-[calc(100dvh-var(--total-padding-mobile)-36px)] sm:h-[100dvh]")} style={{ "--mobile-header-offset": "36px" } as React.CSSProperties}>
            <div
              className={cn(
                "border-0 md:border-l bg-background overflow-hidden flex-1 min-h-0 flex flex-col"
              )}
            >
              <Table
                containerOverflowVisible={false}
                className="border-separate border-spacing-0 w-full table-fixed"
                style={{
                  width: "100%",
                  minWidth: `${totalMinWidth}px`,
                }}
                containerClassName={cn(
                  "h-full overscroll-x-none scrollbar-hide flex-1 min-h-0"
                )}
              >
                <TableHeader className={cn("sticky top-0 z-50 bg-background")}>
                  <TableRow className={cn("bg-muted")}>
                    {GPU_COLUMNS.map((column) => {
                      const isModelColumn = column.id === "gpu_model";
                      return (
                        <TableHead
                          key={column.id}
                          className={cn(
                            "relative select-none truncate border-b border-border bg-background text-foreground",
                            column.id === "provider" && "pl-0 pr-[12px] text-left min-w-[171px]",
                            isModelColumn && "text-left overflow-hidden min-w-[275px]",
                            column.id === "blank" && "min-w-[45px] px-0",
                            column.align === "right" && "text-right",
                            column.align === "center" && "text-center",
                            !isModelColumn && column.id !== "provider" && column.id !== "blank" && `min-w-[${column.minWidth}px]`
                          )}
                          style={{
                            width: isModelColumn ? "auto" : `${column.width}px`,
                            minWidth: isModelColumn ? `${MINIMUM_MODEL_COLUMN_WIDTH}px` : `${column.minWidth}px`,
                          }}
                        >
                          {column.id === "blank" ? (
                            <div className="flex items-center justify-center h-full">
                              <Skeleton className="h-4 w-4 rounded-sm" />
                            </div>
                          ) : column.id === "provider" ? (
                            <div className="pl-0 pr-[12px] h-7 flex items-center">
                              <Skeleton className="h-4 w-20" />
                            </div>
                          ) : column.align === "right" ? (
                            <div className="px-[12px] h-7 flex items-center justify-end">
                              <Skeleton className="h-4 w-20" />
                            </div>
                          ) : (
                            <div className="px-[12px] h-7 flex items-center">
                              <Skeleton className="h-4 w-20" />
                            </div>
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody
                  id="content"
                  tabIndex={-1}
                  className="outline-1 -outline-offset-1 outline-primary transition-colors focus-visible:outline"
                  style={{
                    scrollMarginTop: "40px",
                  }}
                  aria-busy="true"
                  aria-live="polite"
                >
                  {Array.from({ length: SKELETON_ROW_COUNT }).map((_, rowIndex) => (
                    <TableRow
                      key={`skeleton-${rowIndex}`}
                      className={cn(
                        "bg-background border-b transition-colors",
                        "hover:bg-transparent",
                      )}
                    >
                      {GPU_COLUMNS.map((column) => {
                        const isModelColumn = column.id === "gpu_model";
                        return (
                          <TableCell
                            key={`${column.id}-${rowIndex}`}
                            className={cn(
                              "truncate border-b border-border px-[12px] h-[41px]",
                              column.id === "provider" && "text-left min-w-[171px] pl-0",
                              isModelColumn && "text-left overflow-hidden min-w-[275px] pr-0",
                              column.id === "blank" && "text-center p-0 min-w-[45px]",
                              column.align === "right" && "text-right",
                              column.align === "center" && "text-center",
                              !isModelColumn && column.id !== "provider" && column.id !== "blank" && `min-w-[${column.minWidth}px]`
                            )}
                            style={{
                              width: isModelColumn ? "auto" : `${column.width}px`,
                              minWidth: isModelColumn ? `${MINIMUM_MODEL_COLUMN_WIDTH}px` : `${column.minWidth}px`,
                            }}
                          >
                            {column.id === "blank" ? (
                              <div className="flex justify-center">
                                <Skeleton className="h-4 w-4 rounded-sm" />
                              </div>
                            ) : column.id === "provider" ? (
                              <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-5 rounded-full" />
                                <Skeleton className="h-4 w-[6rem]" />
                              </div>
                            ) : isModelColumn ? (
                              <Skeleton className="h-4 w-36 sm:w-48" />
                            ) : (
                              <div className="flex items-center justify-end">
                                <Skeleton className="h-4 w-16" />
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

