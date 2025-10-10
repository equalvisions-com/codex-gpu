"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDataTable } from "@/components/data-table/data-table-provider";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { VisuallyHidden } from "@/components/ui/visually-hidden";

interface SpotlightSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INPUT_ID = "spotlight-search";

export function SpotlightSearchDialog({ open, onOpenChange }: SpotlightSearchDialogProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { columnFilters, setColumnFilters, setRowSelection } = useDataTable();

  const [query, setQuery] = React.useState(() => searchParams.get("search") ?? "");

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    setQuery(searchParams.get("search") ?? "");
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, searchParams]);

  const applySearch = React.useCallback(() => {
    const trimmed = query.trim();
    const nextFilters: ColumnFiltersState = columnFilters.filter(
      (filter) => filter.id !== "search",
    );

    setColumnFilters(
      trimmed
        ? [
            ...nextFilters,
            {
              id: "search",
              value: trimmed,
            },
          ]
        : nextFilters,
    );
    setRowSelection?.({});

    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) {
      params.set("search", trimmed);
    } else {
      params.delete("search");
    }
    params.delete("cursor");
    params.set("start", "0");

    const next = params.toString();
    router.push(next ? `?${next}` : "?", { scroll: false });
    onOpenChange(false);
  }, [columnFilters, onOpenChange, query, router, searchParams, setColumnFilters, setRowSelection]);

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      applySearch();
    },
    [applySearch],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex w-full max-w-2xl flex-col items-center gap-4 border-none bg-transparent p-0 shadow-none [&>button]:hidden"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>Global search</DialogTitle>
        </VisuallyHidden>
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-xl px-4"
          role="search"
          aria-label="GPU pricing search"
        >
          <label htmlFor={INPUT_ID} className="sr-only">
            Search infrastructure catalog
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={INPUT_ID}
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-12 w-full rounded-full border border-border bg-popover pl-12 pr-20 text-base shadow-lg focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Search GPUs"
            />
            <kbd className="select-none rounded border px-1.5 py-px text-[0.7rem] font-normal font-mono shadow-sm disabled:opacity-50 bg-accent ml-auto text-muted-foreground group-hover:text-accent-foreground pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              <span className="mr-1">⌘</span>
              <span>K</span>
            </kbd>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default SpotlightSearchDialog;

