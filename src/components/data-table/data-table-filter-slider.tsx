"use client";

import type { DataTableSliderFilterField } from "./types";
import { Slider } from "@/components/custom/slider";
import { isArrayOfNumbers } from "@/lib/is-array";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useDataTable } from "@/components/data-table/data-table-provider";
import type { ColumnFiltersState } from "@tanstack/react-table";

/**
 * Extracts the slider value from filter state.
 * For range filters [min, max], returns the upper bound (max) which represents the selected slider position.
 */
function getFilter(filterValue: unknown): number | null {
  return typeof filterValue === "number"
    ? filterValue
    : Array.isArray(filterValue) && isArrayOfNumbers(filterValue)
      ? filterValue.length >= 2
        ? filterValue[1] // Take the selected value (upper bound)
        : filterValue[0]
      : null;
}

/**
 * A self-managed slider filter component for data tables.
 *
 * Features:
 * - Single-handle range slider (filters from 1K to selected value)
 * - Visual grid lines with intermediate markers for precise reference
 * - Smooth continuous movement (no stepping)
 * - Memoized calculations for optimal performance
 * - Proper state management following React best practices
 *
 * @template TData - The data type for the table rows
 */
function DataTableFilterSliderComponent<TData>({
  value: _value,
  min: defaultMin,
  max: defaultMax,
}: DataTableSliderFilterField<TData>) {
  const value = _value as string;
  const { columnFilters, setColumnFilters } = useDataTable();

  // Extract current value from filters (single source of truth)
  const currentValue = useMemo(() => {
    const filter = columnFilters.find(f => f.id === value);
    return filter?.value && Array.isArray(filter.value)
      ? filter.value[1] || defaultMax
      : defaultMax;
  }, [columnFilters, value, defaultMax]);

  // Local state for responsive UI updates (synced with external state)
  const [localValue, setLocalValue] = useState(currentValue);

  // Sync local state when external filter changes
  useEffect(() => {
    setLocalValue(currentValue);
  }, [currentValue]);

  // Debounced version for API calls (prevents excessive filter updates)
  const debouncedValue = useDebounce(localValue, 500);

  // Ref to access current columnFilters without dependency (avoids circular dependency)
  const columnFiltersRef = useRef(columnFilters);
  columnFiltersRef.current = columnFilters;

  // Apply filter when debounced value changes (single effect for all filter logic)
  useEffect(() => {
    const otherFilters = columnFiltersRef.current.filter((f: any) => f.id !== value);
    const newFilters = debouncedValue >= defaultMax
      ? otherFilters // Remove filter at max (show all)
      : [...otherFilters, { id: value, value: [0, debouncedValue] }]; // Apply filter

    setColumnFilters(newFilters);
  }, [debouncedValue, value, defaultMax, setColumnFilters]);

  // Memoize expensive grid line calculations
  const gridLinePositions = useMemo(() => {
    const min = defaultMin;
    const max = defaultMax;
    if (min >= max) return { pos1: '2%', pos2: '50%', pos3: '98%', pos4: '75%', pos5: '85%', pos6: '92%' };

    const pos1 = '2%'; // 1K (start)
    const pos2 = `${Math.max(0, Math.min(100, ((166667 - min) / (max - min) * 100)))}%`; // ~167K (1/3 between 1K-500K)
    const pos3 = `${Math.max(0, Math.min(100, ((333333 - min) / (max - min) * 100)))}%`; // ~333K (2/3 between 1K-500K)
    const pos4 = `${Math.max(0, Math.min(100, ((500000 - min) / (max - min) * 100)))}%`; // 500K
    const pos5 = `${Math.max(0, Math.min(100, ((666667 - min) / (max - min) * 100)))}%`; // ~667K (1/3 between 500K-1M)
    const pos6 = `${Math.max(0, Math.min(100, ((833333 - min) / (max - min) * 100)))}%`; // ~833K (2/3 between 500K-1M)
    const pos7 = '98%'; // 1M+ (end)

    return { pos1, pos2, pos3, pos4, pos5, pos6, pos7 };
  }, [defaultMin, defaultMax]);

  // Stable change handler
  const handleChange = useCallback((values: number[]) => {
    setLocalValue(values[0]);
  }, []);

  return (
    <div className="grid gap-2">
      <Slider
        min={defaultMin}
        max={defaultMax}
        value={[localValue]}
        onValueChange={handleChange}
      />
      <div className="relative px-2 pb-4">
        <div className="absolute inset-0">
          {/* Vertical grid lines */}
          <div className="absolute w-px h-2 bg-muted-foreground/30" style={{ left: gridLinePositions.pos1, top: '0' }}></div>
          <div className="absolute w-px h-2 bg-muted-foreground/30" style={{ left: gridLinePositions.pos2, top: '0' }}></div>
          <div className="absolute w-px h-2 bg-muted-foreground/30" style={{ left: gridLinePositions.pos3, top: '0' }}></div>
          <div className="absolute w-px h-2 bg-muted-foreground/30" style={{ left: gridLinePositions.pos4, top: '0' }}></div>
          <div className="absolute w-px h-2 bg-muted-foreground/30" style={{ left: gridLinePositions.pos5, top: '0' }}></div>
          <div className="absolute w-px h-2 bg-muted-foreground/30" style={{ left: gridLinePositions.pos6, top: '0' }}></div>
          <div className="absolute w-px h-2 bg-muted-foreground/30" style={{ left: gridLinePositions.pos7, top: '0' }}></div>

          {/* Labels - centered below grid lines */}
          <span className="absolute text-[10px] text-muted-foreground text-center" style={{ left: gridLinePositions.pos1, top: '12px', transform: 'translateX(-50%)' }}>1K</span>
          <span className="absolute text-[10px] text-muted-foreground text-center" style={{ left: gridLinePositions.pos4, top: '12px', transform: 'translateX(-50%)' }}>500K</span>
          <span className="absolute text-[10px] text-muted-foreground text-center" style={{ left: gridLinePositions.pos7, top: '12px', transform: 'translateX(-50%)' }}>1M+</span>
        </div>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders when props haven't changed
export const DataTableFilterSlider = memo(DataTableFilterSliderComponent);
