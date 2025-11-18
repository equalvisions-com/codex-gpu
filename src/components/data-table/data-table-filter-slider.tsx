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

const GPU_PRICE_SLIDER_MIN = 0.01;
const GPU_PRICE_SLIDER_MAX = 20;
const GPU_PRICE_SLIDER_STEP = 0.01;
const VRAM_STOPS = [16, 32, 48, 64, 80, 96, 192];
const VRAM_VALUE_MIN = VRAM_STOPS[0];
const VRAM_VALUE_MAX = VRAM_STOPS[VRAM_STOPS.length - 1];
const VRAM_SLIDER_MIN = 0;
const VRAM_SLIDER_MAX = VRAM_STOPS.length - 1;
const VRAM_SLIDER_STEP = 0.001;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sliderToVram(sliderValue: number) {
  const clamped = clamp(sliderValue, VRAM_SLIDER_MIN, VRAM_SLIDER_MAX);
  const lowerIndex = Math.floor(clamped);
  const upperIndex = Math.min(VRAM_STOPS.length - 1, Math.ceil(clamped));

  if (lowerIndex === upperIndex) {
    return VRAM_STOPS[lowerIndex];
  }

  const lowerValue = VRAM_STOPS[lowerIndex];
  const upperValue = VRAM_STOPS[upperIndex];
  const fraction = clamped - lowerIndex;

  return lowerValue + (upperValue - lowerValue) * fraction;
}

function vramValueToSlider(vramValue: number) {
  const clamped = clamp(vramValue, VRAM_VALUE_MIN, VRAM_VALUE_MAX);

  for (let index = 0; index < VRAM_STOPS.length - 1; index++) {
    const lower = VRAM_STOPS[index];
    const upper = VRAM_STOPS[index + 1];

    if (clamped <= upper) {
      const fraction = (clamped - lower) / (upper - lower);
      return index + fraction;
    }
  }

  return VRAM_SLIDER_MAX;
}

type SliderConfig = {
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
  valueMin: number;
  valueMax: number;
  toSlider: (value: number) => number;
  fromSlider: (sliderValue: number) => number;
  postProcessMax?: (value: number) => number;
  tickValues: number[];
  labelValues: number[];
  formatLabel: (value: number) => string;
};

const GPU_PRICE_TICKS = Array.from({ length: 7 }, (_, index) => {
  if (index === 0) return GPU_PRICE_SLIDER_MIN;
  if (index === 6) return GPU_PRICE_SLIDER_MAX;
  const fraction = index / 6;
  return GPU_PRICE_SLIDER_MIN + (GPU_PRICE_SLIDER_MAX - GPU_PRICE_SLIDER_MIN) * fraction;
});

const SLIDER_CONFIG: Record<"price_hour_usd" | "vram_gb", SliderConfig> = {
  price_hour_usd: {
    sliderMin: GPU_PRICE_SLIDER_MIN,
    sliderMax: GPU_PRICE_SLIDER_MAX,
    sliderStep: GPU_PRICE_SLIDER_STEP,
    valueMin: GPU_PRICE_SLIDER_MIN,
    valueMax: GPU_PRICE_SLIDER_MAX,
    toSlider: value => clamp(value, GPU_PRICE_SLIDER_MIN, GPU_PRICE_SLIDER_MAX),
    fromSlider: sliderValue => clamp(sliderValue, GPU_PRICE_SLIDER_MIN, GPU_PRICE_SLIDER_MAX),
    postProcessMax: value => Number(value.toFixed(2)),
    tickValues: GPU_PRICE_TICKS,
    labelValues: [GPU_PRICE_SLIDER_MIN, 10, GPU_PRICE_SLIDER_MAX],
    formatLabel: value => {
      if (value >= GPU_PRICE_SLIDER_MAX) {
        return `$${value.toFixed(0)}+`;
      }
      if (value <= GPU_PRICE_SLIDER_MIN) {
        return `$${value.toFixed(2)}`;
      }
      return `$${value.toFixed(0)}`;
    },
  },
  vram_gb: {
    sliderMin: VRAM_SLIDER_MIN,
    sliderMax: VRAM_SLIDER_MAX,
    sliderStep: VRAM_SLIDER_STEP,
    valueMin: VRAM_VALUE_MIN,
    valueMax: VRAM_VALUE_MAX,
    toSlider: vramValueToSlider,
    fromSlider: sliderToVram,
    postProcessMax: value => Math.round(value),
    tickValues: VRAM_STOPS,
    labelValues: [VRAM_VALUE_MIN, VRAM_STOPS[3], VRAM_VALUE_MAX],
    formatLabel: value => {
      const numeric = Math.round(value);
      return numeric >= VRAM_VALUE_MAX ? `${numeric}GB+` : `${numeric}GB`;
    },
  },
};

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
  label,
}: DataTableSliderFilterField<TData>) {
  const value = _value as string;
  const { columnFilters, setColumnFilters } = useDataTable();
  const isPriceFilter = value === "inputPrice";
  const sliderConfig = isPriceFilter
    ? undefined
    : SLIDER_CONFIG[value as keyof typeof SLIDER_CONFIG];
  const sliderRangeMin = isPriceFilter
    ? PROMPT_PRICE_SLIDER_MIN
    : sliderConfig?.sliderMin ?? defaultMin;
  const sliderRangeMax = isPriceFilter
    ? PROMPT_PRICE_SLIDER_MAX
    : sliderConfig?.sliderMax ?? defaultMax;
  const sliderStep = isPriceFilter
    ? PROMPT_PRICE_SLIDER_STEP
    : sliderConfig?.sliderStep ?? step;

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
        if (isPriceFilter) {
          return priceToSlider(raw / 1_000_000);
        }
        if (sliderConfig) {
          const min = typeof sliderRangeMin === "number" ? sliderRangeMin : sliderConfig.sliderMin;
          const max = typeof sliderRangeMax === "number" ? sliderRangeMax : sliderConfig.sliderMax;
          return clamp(sliderConfig.toSlider(raw), min, max);
        }
        return raw;
      }
    }

    if (sliderConfig) {
      return typeof sliderRangeMax === "number" ? sliderRangeMax : sliderConfig.sliderMax;
    }

    return sliderRangeMax ?? defaultMax ?? 0;
  }, [
    columnFilters,
    defaultMax,
    isPriceFilter,
    priceToSlider,
    sliderConfig,
    sliderRangeMax,
    sliderRangeMin,
    value,
  ]);

  // Local state for responsive UI updates (synced with external state)
  const [localValue, setLocalValue] = useState(currentValue);
  const isUserInteractingRef = useRef(false);

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
    if (!isUserInteractingRef.current) {
      return;
    }

    const finishInteraction = () => {
      isUserInteractingRef.current = false;
    };

    const otherFilters = columnFiltersRef.current.filter((f: any) => f.id !== value);
    const tolerance = Math.max(1e-12, sliderStep ?? (defaultMax - defaultMin) * 0.001);

    if (isPriceFilter) {
      const isAtMax = debouncedValue >= sliderRangeMax - tolerance;
      const actualMax = sliderToPrice(debouncedValue);
      const normalizedMax = Number((actualMax * 1_000_000).toFixed(PROMPT_PRICE_DECIMALS));
      const normalizedMin = 0;

      if (!isAtMax) {
        const previous = columnFiltersRef.current.find((f: any) => f.id === value);
        if (previous && Array.isArray(previous.value)) {
          const [prevMin, prevMax] = previous.value as (string | number)[];
          if (Number(prevMax) === Number(normalizedMax) && Number(prevMin) === Number(normalizedMin)) {
            finishInteraction();
            return;
          }
        }
      }

      const newFilters = isAtMax
        ? otherFilters
        : [...otherFilters, { id: value, value: [normalizedMin, normalizedMax] }];

      setColumnFilters(newFilters);
      finishInteraction();
      return;
    }

    if (sliderConfig) {
      const isAtMax = debouncedValue >= sliderRangeMax - tolerance;
      const rawMax = sliderConfig.fromSlider(debouncedValue);
      const processedMax = sliderConfig.postProcessMax
        ? sliderConfig.postProcessMax(rawMax)
        : rawMax;
      const boundedMax = clamp(processedMax, sliderConfig.valueMin, sliderConfig.valueMax);
      const normalizedMin = sliderConfig.valueMin;

      if (!isAtMax) {
        const previous = columnFiltersRef.current.find((f: any) => f.id === value);
        if (previous && Array.isArray(previous.value)) {
          const [prevMin, prevMax] = previous.value as (string | number)[];
          if (Number(prevMax) === Number(boundedMax) && Number(prevMin) === Number(normalizedMin)) {
            finishInteraction();
            return;
          }
        }
      }

      const newFilters = isAtMax
        ? otherFilters
        : [...otherFilters, { id: value, value: [normalizedMin, boundedMax] }];

      setColumnFilters(newFilters);
      finishInteraction();
      return;
    }

    const isAtMax = debouncedValue >= sliderRangeMax - tolerance;
    const maxValue = debouncedValue;
    const normalizedMin = typeof sliderRangeMin === "number"
      ? sliderRangeMin
      : typeof defaultMin === "number"
        ? defaultMin
        : 0;

    if (!isAtMax) {
      const previous = columnFiltersRef.current.find((f: any) => f.id === value);
      if (previous && Array.isArray(previous.value)) {
        const [prevMin, prevMax] = previous.value as (string | number)[];
        if (Number(prevMax) === Number(maxValue) && Number(prevMin) === Number(normalizedMin)) {
          finishInteraction();
          return;
        }
      }
    }

    const newFilters = isAtMax
      ? otherFilters
      : [...otherFilters, { id: value, value: [normalizedMin, maxValue] }];

    setColumnFilters(newFilters);
    finishInteraction();
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
    sliderConfig,
  ]);
  // Memoize expensive grid line calculations
  const sliderMarks = useMemo(() => {
    const min = typeof sliderRangeMin === "number"
      ? sliderRangeMin
      : sliderConfig?.sliderMin ?? sliderRangeMin ?? 0;
    const max = typeof sliderRangeMax === "number"
      ? sliderRangeMax
      : sliderConfig?.sliderMax ?? sliderRangeMax ?? 0;
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

    if (sliderConfig) {
      const sliderPositions = sliderConfig.tickValues.map(tick => sliderConfig.toSlider(tick));
      const rawLines = sliderPositions.map(toPercent);
      const useEdgeOffsets =
        (value === "price_hour_usd" || value === "vram_gb") && rawLines.length > 0;

      if (useEdgeOffsets) {
        rawLines[0] = "3%";
        rawLines[rawLines.length - 1] = "97%";
      }

      const lines = rawLines.filter((pos, index, arr) => arr.indexOf(pos) === index);

      const labels = sliderConfig.labelValues.map((labelValue, index, arr) => {
        let position = toPercent(sliderConfig.toSlider(labelValue));
        if (useEdgeOffsets) {
          if (index === 0) position = "3%";
          if (index === arr.length - 1) position = "97%";
        }
        return {
          pos: position,
          label: sliderConfig.formatLabel(labelValue),
        };
      });

      return { lines, labels };
    }

    return { lines: [], labels: [] };
  }, [sliderRangeMin, sliderRangeMax, sliderConfig, value, defaultMin, defaultMax]);

  // Stable change handler
  const handleChange = useCallback((values: number[]) => {
    isUserInteractingRef.current = true;
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
        aria-label={`${label} filter slider`}
        thumbLabel={`${label} filter slider`}
      />
      {(sliderMarks.lines.length > 0 || sliderMarks.labels.length > 0) ? (
        <div className="px-2">
          <div className="relative h-2 pointer-events-none">
            {sliderMarks.lines.map((pos, index) => (
              <div
                key={`line-${index}`}
                className="absolute inset-y-0 w-px bg-muted-foreground/50"
                style={{ left: pos, transform: "translateX(-50%)" }}
              />
            ))}
          </div>
          {sliderMarks.labels.length > 0 ? (
            <div className="relative mt-[3px] h-3 text-[10px] text-foreground/70 pointer-events-none">
              {sliderMarks.labels.map(({ pos, label }, index) => (
                <span
                  key={`label-${label}-${index}`}
                  className="absolute -translate-x-1/2 leading-none"
                  style={{ left: pos }}
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders when props haven't changed
export const DataTableFilterSlider = memo(DataTableFilterSliderComponent);
