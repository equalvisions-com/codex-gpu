"use client";

import type { DataTableInputFilterField } from "./types";
import { InputWithAddons } from "@/components/custom/input-with-addons";
import { Label } from "@/components/ui/label";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useDataTable } from "@/components/data-table/data-table-provider";

function getFilter(filterValue: unknown) {
  return typeof filterValue === "string" ? filterValue : null;
}

export function DataTableFilterInput<TData>({
  value: _value,
  autoFocus,
}: DataTableInputFilterField<TData> & { autoFocus?: boolean }) {
  const value = _value as string;
  const { columnFilters, setColumnFilters } = useDataTable();
  const filterValue = columnFilters.find((i) => i.id === value)?.value;
  const filters = getFilter(filterValue);
  const [input, setInput] = useState<string | null>(filters);

  // Track if the current input change came from user interaction
  const isUserInputRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedInput = useDebounce(input, 500);

  // Apply filter when debounced input changes (only from user input)
  useEffect(() => {
    if (!isUserInputRef.current) return;

    const newValue = debouncedInput?.trim() === "" ? null : debouncedInput;

    setColumnFilters((current) => {
      if (newValue === null || newValue === undefined) {
        return current.filter((filter) => filter.id !== value);
      }

      const existingIndex = current.findIndex((filter) => filter.id === value);
      if (existingIndex === -1) {
        return [...current, { id: value, value: newValue }];
      }

      return current.map((filter, index) =>
        index === existingIndex ? { ...filter, value: newValue } : filter,
      );
    });

    isUserInputRef.current = false;
  }, [debouncedInput, setColumnFilters, value]);

  // Sync external changes to local state (but not when user is typing)
  useEffect(() => {
    // Don't sync if user is currently typing
    if (isUserInputRef.current) return;

    if (filters !== input) {
      setInput(filters);
    }
  }, [filters, input]);

  const isFilterActive = Boolean(filters && filters.trim() !== "");

  const handleClear = () => {
    isUserInputRef.current = false;
    if (isFilterActive) {
      setColumnFilters((current) => current.filter((filter) => filter.id !== value));
    }
    setInput(null);
    inputRef.current?.focus();
  };

  return (
    <div className="grid w-full gap-1.5">
      <Label htmlFor={value} className="sr-only px-2 text-muted-foreground">
        {value}
      </Label>
      <div className="relative">
        <InputWithAddons
          ref={inputRef}
          placeholder="Search"
          leading={<Search className="mt-[1px] h-4 w-4" />}
          containerClassName="h-9 rounded-lg"
          autoFocus={autoFocus}
          className="placeholder:text-foreground/70 pr-20"
          name={value}
          id={value}
          value={input || ""}
          onChange={(e) => {
            isUserInputRef.current = true;
            setInput(e.target.value);
          }}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {!isFilterActive ? (
             <span className="inline-flex select-none items-center gap-1 rounded border px-[6px] py-0 text-xs font-mono font-normal h-[18px] bg-accent text-muted-foreground">
            <span className="opacity-90">⌘</span>
            <span className="tracking-tight opacity-70">/</span> </span>
          ) : null}
          {isFilterActive ? (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex h-5 items-center justify-center rounded-full border border-input bg-background px-1.5 py-1 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Clear search filter"
              title="Clear search filter"
            >
              <X className="h-2.5 w-2.5 text-muted-foreground" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
