"use client";

import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CheckboxListSkeletonProps {
  rows?: number;
  className?: string;
  itemClassName?: string;
  labelClassName?: string;
}

export function CheckboxListSkeleton({
  rows = 4,
  className,
  itemClassName,
  labelClassName,
}: CheckboxListSkeletonProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <ScrollArea className="max-h-[149px]">
        <div className="space-y-2 pr-0">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "group relative flex items-center gap-2 px-2 py-2",
                itemClassName,
              )}
            >
              <div className="flex w-full items-center truncate text-foreground group-hover:text-accent-foreground">
                <Skeleton
                  className={cn(
                    "h-4 w-1/2 rounded-full",
                    labelClassName,
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
