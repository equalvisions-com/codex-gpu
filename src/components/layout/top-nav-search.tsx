"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TopNavSearchProps {
  className?: string;
  placeholder?: string;
}

export function TopNavSearch({
  className,
  placeholder = "Search"
}: TopNavSearchProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        className="pl-10 pr-16 h-9 border bg-muted focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 select-none rounded border px-1.5 py-px text-[0.7rem] font-normal font-mono shadow-sm bg-accent text-muted-foreground">
        <span className="mr-1">⌘</span>
        <span>K</span>
      </kbd>
    </div>
  );
}
