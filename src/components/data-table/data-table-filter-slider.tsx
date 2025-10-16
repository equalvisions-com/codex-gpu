"use client";

import type { DataTableSliderFilterField } from "./types";
import { Slider } from "@/components/custom/slider";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useDataTable } from "@/components/data-table/data-table-provider";

const PROMPT_PRICE_SLIDER_MIN = 0;
const PROMPT_PRICE_SLIDER_MAX = 1;
const PROMPT_PRICE_SLIDER_STEP = 0.001;
const PROMPT_PRICE_DECIMALS = 2;
const PROMPT_PRICE_EXPONENT = Math.log(4 / 9) / Math.log(0.5);

/**
 * Prompt price slider uses a hybrid scale:
 * - 0 → 0.5 covers $0 → $1 linearly for fine-grained free-tier values.
 * - 0.5 → 1 progresses toward $10 with a calibrated easing so the midpoint lands exactly at $5.
 */

function pricePerTokenToSlider(perToken: number): number {
  const perMillion = Math.max(0, Math.min(10, perToken * 1_000_000));
  if (perMillion <= 1) {
    return (perMillion / 1) * 0.5;
  }

  const ratio = (perMillion - 1) / 9;
  const clamped = Math.max(0, Math.min(1, ratio));
  return 0.5 + Math.pow(clamped, 1 / PROMPT_PRICE_EXPONENT) * 0.5;
}

function sliderToPricePerToken(sliderValue: number): number {
  const clamped = Math.max(PROMPT_PRICE_SLIDER_MIN, Math.min(PROMPT_PRICE_SLIDER_MAX, sliderValue));

  if (clamped <= 0.5) {
    const perMillion = (clamped / 0.5) * 1;
    return perMillion / 1_000_000;
  }

  const ratio = (clamped - 0.5) / 0.5;
  const perMillion = 1 + Math.pow(Math.max(0, Math.min(1, ratio)), PROMPT_PRICE_EXPONENT) * 9;
  return perMillion / 1_000_000;
}

function getPromptPriceGridLines() {
  // Evenly spaced ticks before and after $1 in slider-space.
  const preOnePositions = [
    pricePerTokenToSlider(0.33 / 1_000_000),
    pricePerTokenToSlider(0.67 / 1_000_000),
  ];
  const postOneStep = 0.5 / 3;
  const postOnePositions = [
    0.5 + postOneStep,
    0.5 + postOneStep * 2,
  ];

  const sliderPositions = [
    PROMPT_PRICE_SLIDER_MIN,
    ...preOnePositions,
    0.5,
    ...postOnePositions,
    PROMPT_PRICE_SLIDER_MAX,
  ];

  return sliderPositions;
}

/**
 * Extracts the slider value from filter state.
 * For range filters [min, max], returns the upper bound (max) which represents the selected slider position.
 */
function coerceNumeric(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getFilter(filterValue: unknown): number | null {
  const numeric = coerceNumeric(filterValue);
  if (numeric !== null) return numeric;

  if (Array.isArray(filterValue)) {
    const coerced = filterValue
      .map(coerceNumeric)
      .filter((val): val is number => val !== null);

    if (coerced.length === 0) return null;
    return coerced.length >= 2 ? coerced[1] : coerced[0];
  }

  return null;
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
  step,
}: DataTableSliderFilterField<TData>) {
  const value = _value as string;
  const { columnFilters, setColumnFilters } = useDataTable();
  const isPriceFilter = value === "inputPrice";
  const sliderRangeMin = isPriceFilter ? PROMPT_PRICE_SLIDER_MIN : defaultMin;
  const sliderRangeMax = isPriceFilter ? PROMPT_PRICE_SLIDER_MAX : defaultMax;
  const sliderStep = isPriceFilter ? PROMPT_PRICE_SLIDER_STEP : step;

  const priceToSlider = useCallback(
    (pricePerToken: number) => {
      if (!isPriceFilter) return pricePerToken;

      return pricePerTokenToSlider(pricePerToken);
    },
    [isPriceFilter],
  );

  const sliderToPrice = useCallback(
    (sliderValue: number) => {
      if (!isPriceFilter) return sliderValue;

      return sliderToPricePerToken(sliderValue);
    },
    [isPriceFilter],
  );

  // Extract current value from filters (single source of truth)
  const currentValue = useMemo(() => {
    const filter = columnFilters.find(f => f.id === value);
    if (filter?.value && Array.isArray(filter.value)) {
      const raw = getFilter(filter.value);
      if (typeof raw === "number") {
        const asPerToken = isPriceFilter ? raw / 1_000_000 : raw;
        return priceToSlider(asPerToken);
      }
    }
    return sliderRangeMax;
  }, [columnFilters, value, sliderRangeMax, priceToSlider, isPriceFilter]);

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
    const tolerance = Math.max(1e-12, sliderStep ?? (defaultMax - defaultMin) * 0.001);
    const isAtMax = debouncedValue >= sliderRangeMax - tolerance;
    const actualMax = sliderToPrice(debouncedValue);
    const normalizedMax = isPriceFilter
      ? Number((actualMax * 1_000_000).toFixed(PROMPT_PRICE_DECIMALS))
      : actualMax;
    const normalizedMin = isPriceFilter ? 0 : sliderRangeMin;

    if (!isAtMax) {
      const previous = columnFiltersRef.current.find((f: any) => f.id === value);
      if (previous && Array.isArray(previous.value)) {
        const [prevMin, prevMax] = previous.value as (string | number)[];
        if (Number(prevMax) === Number(normalizedMax) && Number(prevMin) === Number(normalizedMin)) {
          return;
        }
      }
    }

    const newFilters = isAtMax
      ? otherFilters // Remove filter at max (show all)
      : [...otherFilters, { id: value, value: [normalizedMin, normalizedMax] }];

    setColumnFilters(newFilters);
  }, [
    debouncedValue,
    value,
    sliderRangeMax,
    sliderRangeMin,
    setColumnFilters,
    sliderStep,
    sliderToPrice,
    defaultMax,
    defaultMin,
    isPriceFilter,
  ]);

  // Memoize expensive grid line calculations
  const sliderMarks = useMemo(() => {
    const min = sliderRangeMin;
    const max = sliderRangeMax;
    if (min >= max) {
      return { lines: [] as string[], labels: [] as { pos: string; label: string }[] };
    }

    const toPercent = (sliderValue: number) => {
      const normalized = (sliderValue - min) / (max - min);
      return `${Math.max(0, Math.min(100, normalized * 100))}%`;
    };

    if (value === "contextLength") {
      const min = defaultMin;
      const max = defaultMax;
      const position = (val: number) => `${Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100))}%`;
      const pos1 = "2%";
      const pos2 = position(166667);
      const pos3 = position(333333);
      const pos4 = position(500000);
      const pos5 = position(666667);
      const pos6 = position(833333);
      const pos7 = "98%";

      return {
        lines: [pos1, pos2, pos3, pos4, pos5, pos6, pos7],
        labels: [
          { pos: "3%", label: "1K" },
          { pos: pos4, label: "500K" },
          { pos: "97%", label: "1M+" },
        ],
      };
    }

    if (value === "inputPrice") {
      const rawLines = getPromptPriceGridLines();
      const lines = rawLines
        .map((sliderValue, index, arr) => {
          if (index === 0) return "3%";
          if (index === arr.length - 1) return "97%";
          return toPercent(sliderValue);
        })
        .filter((pos, index, arr) => arr.indexOf(pos) === index);

      const labels = [
        { pos: "3%", label: "FREE" },
        { pos: toPercent(0.5), label: "$1" },
        { pos: "97%", label: "$10+" },
      ];

      return { lines, labels };
    }

    return { lines: [], labels: [] };
  }, [sliderRangeMin, sliderRangeMax, value, defaultMin, defaultMax]);

  // Stable change handler
  const handleChange = useCallback((values: number[]) => {
    setLocalValue(values[0]);
  }, []);

  return (
    <div className="grid gap-2">
      <Slider
        min={sliderRangeMin}
        max={sliderRangeMax}
        step={sliderStep}
        value={[localValue]}
        onValueChange={handleChange}
      />
      <div className="relative px-2 pb-4">
        <div className="absolute inset-0">
          {/* Vertical grid lines & labels */}
          {sliderMarks.lines.map((pos, index) => (
            <div
              key={`line-${index}`}
              className="absolute w-px h-2 bg-muted-foreground/30"
              style={{ left: pos, top: 0, transform: "translateX(-50%)" }}
            />
          ))}
          {sliderMarks.labels.map(({ pos, label }, index) => (
            <span
              key={`label-${label}-${index}`}
              className="absolute text-[10px] text-foreground/70 text-center"
              style={{ left: pos, top: "12px", transform: "translateX(-50%)" }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders when props haven't changed
export const DataTableFilterSlider = memo(DataTableFilterSliderComponent);
