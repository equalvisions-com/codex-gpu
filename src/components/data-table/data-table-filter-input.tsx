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
}: DataTableInputFilterField<TData>) {
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
    // Only apply filter if this came from user input
    if (!isUserInputRef.current) return;

    const newValue = debouncedInput?.trim() === "" ? null : debouncedInput;
    const newFilters = columnFilters.map(f =>
      f.id === value
        ? { ...f, value: newValue }
        : f
    );
    if (!columnFilters.find(f => f.id === value) && newValue !== null) {
      newFilters.push({ id: value, value: newValue });
    }

    setColumnFilters(newFilters.filter(f => f.value !== null && f.value !== undefined));
    isUserInputRef.current = false; // Reset after applying
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
      const newFilters = columnFilters.filter((f) => f.id !== value);
      setColumnFilters(newFilters);
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
          className="placeholder:text-foreground/70 pr-12"
          name={value}
          id={value}
          value={input || ""}
          onChange={(e) => {
            isUserInputRef.current = true;
            setInput(e.target.value);
          }}
        />
        {isFilterActive ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 inline-flex h-5 -translate-y-1/2 items-center justify-center rounded-full border border-input bg-background px-1.5 py-1 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Clear search filter"
            title="Clear search filter"
          >
            <X className="h-2.5 w-2.5 text-muted-foreground" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
