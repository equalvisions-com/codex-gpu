"use client";

import type { DataTableInputFilterField } from "./types";
import { InputWithAddons } from "@/components/custom/input-with-addons";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
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
  const { table, columnFilters, setColumnFilters } = useDataTable();
  const filterValue = columnFilters.find((i) => i.id === value)?.value;
  const filters = getFilter(filterValue);
  const [input, setInput] = useState<string | null>(filters);

  // Track if the current input change came from user interaction
  const isUserInputRef = useRef(false);

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

  return (
    <div className="grid w-full gap-1.5">
      <Label htmlFor={value} className="sr-only px-2 text-muted-foreground">
        {value}
      </Label>
      <InputWithAddons
        placeholder="Search"
        leading={<Search className="mt-0.5 h-4 w-4" />}
        containerClassName="h-9 rounded-lg"
        name={value}
        id={value}
        value={input || ""}
        onChange={(e) => {
          isUserInputRef.current = true;
          setInput(e.target.value);
        }}
      />
    </div>
  );
}
