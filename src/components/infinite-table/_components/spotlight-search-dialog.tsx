"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { searchParamsSerializer } from "@/components/infinite-table/search-params";
import type { ColumnSchema } from "@/components/infinite-table/schema";
import { useDataTable } from "@/components/data-table/data-table-provider";
import type { ColumnFiltersState, RowSelectionState } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

const MIN_QUERY_LENGTH = 2;

interface SpotlightSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SpotlightResult {
  uuid: string;
  type: "gpu" | "cpu";
  model: string;
  provider: string;
  price_hour_usd?: number;
  price_usd?: number;
  vcpus?: number | string;
  gpu_count?: number;
  vram_gb?: number;
  system_ram_gb?: number;
  class: string;
}

// Separate component for search results that filters preloaded data
function SearchResults({
  allData,
  query,
  shouldQuery,
  onResultSelect,
}: {
  allData: SpotlightResult[];
  query: string;
  shouldQuery: boolean;
  onResultSelect: (result: SpotlightResult, searchQuery: string) => void;
}) {
  // Client-side filtering of preloaded data - comprehensive query-based search
  const results = React.useMemo(() => {
    if (!shouldQuery || !query.trim()) return [];

    const searchLower = query.toLowerCase();
    const filteredData = allData
      .filter(item => {
        // Search across all relevant fields
        const searchableFields = [
          item.model,
          item.provider,
          item.type,
          item.class,
          // Include hardware specs as searchable text
          item.gpu_count ? `${item.gpu_count}x GPU` : null,
          item.vram_gb ? `${item.vram_gb}GB VRAM` : null,
          item.vcpus ? `${item.vcpus} vCPU${Number(item.vcpus) !== 1 ? 's' : ''}` : null,
          item.system_ram_gb ? `${item.system_ram_gb}GB RAM` : null,
          // Include price information
          item.price_hour_usd ? `$${item.price_hour_usd.toFixed(2)}/hr` : null,
          item.price_usd ? `$${item.price_usd.toFixed(2)}/hr` : null,
        ].filter(Boolean); // Remove null values

        // Check if any field contains the search query
        return searchableFields.some(field =>
          field?.toLowerCase().includes(searchLower)
        );
      });

    // Deduplicate by model name - show each unique model only once
    const uniqueModels = new Map<string, SpotlightResult>();
    filteredData.forEach(item => {
      if (!uniqueModels.has(item.model)) {
        uniqueModels.set(item.model, item);
      }
    });

    return Array.from(uniqueModels.values());
  }, [allData, query, shouldQuery]);

  if (!shouldQuery) {
    return null;
  }

  if (results.length === 0) {
    return <p className="text-sm text-muted-foreground">No matches found.</p>;
  }

  return (
    <div className="space-y-2">
      {results.map((row) => (
        <button
          key={row.uuid}
          type="button"
          onClick={() => onResultSelect(row, query)}
          className={cn(
            "flex w-full rounded-lg border border-transparent bg-muted/40 px-3 py-2 text-left transition hover:border-border hover:bg-muted",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
        >
          <span className="text-sm font-medium text-foreground">{row.model}</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {row.type.toUpperCase()}
          </span>
        </button>
      ))}
    </div>
  );
}

// Loading fallback for Suspense
function SearchResultsSkeleton() {
  return <p className="text-sm text-muted-foreground">Searching…</p>;
}

export function SpotlightSearchDialog({ open, onOpenChange }: SpotlightSearchDialogProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebounce(query.trim(), 200);
  const shouldQuery = open && debouncedQuery.length >= MIN_QUERY_LENGTH;
  const { columnFilters, setColumnFilters, setRowSelection } =
    useDataTable<ColumnSchema, unknown>();
  const router = useRouter();

  React.useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
      return () => cancelAnimationFrame(frame);
    }
    setQuery("");
  }, [open]);

  // Preload all search data when dialog opens
  const preloadQuery = useQuery({
    queryKey: ["spotlight-preload"],
    queryFn: async () => {
      const response = await fetch(`/api/search?preload=true`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "force-cache", // Use cached version if available
      });
      if (!response.ok) throw new Error("Failed to preload search data");
      const data = (await response.json()) as { data: SpotlightResult[] };
      return data.data;
    },
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    enabled: open,
  });
  const isLoadingPreload = preloadQuery.isLoading || preloadQuery.isFetching;

  const applyFilters = React.useCallback(
    (result: SpotlightResult, searchQuery: string) => {
      // For CPU results, navigate to the CPU page with search parameter
      if (result.type === "cpu") {
        router.push(`/cpus?search=${encodeURIComponent(result.model)}`);
        onOpenChange(false);
        return;
      }

      // For GPU results, navigate to the main table with the specific model name
      // This will show only results that match this exact model
      router.push(`/?search=${encodeURIComponent(result.model)}`);
      onOpenChange(false);
    },
    [onOpenChange, router],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-md border bg-background/95 p-0 backdrop-blur"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>Search Infrastructure</DialogTitle>
        </VisuallyHidden>
        <h2 className="text-lg font-semibold leading-none tracking-tight">Search</h2>
        <div className="relative">
          <Search className="absolute left-[12px] top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={inputRef}
            value={query}
            placeholder=""
            onChange={(event) => setQuery(event.target.value)}
            className="bg-transparent pl-[36px] text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label="Search infrastructure"
          />
        </div>
        <div className="h-[222px] space-y-6 overflow-y-auto ">
          {isLoadingPreload ? (
            <SearchResultsSkeleton />
          ) : (
            <SearchResults
              allData={preloadQuery.data ?? []}
              query={debouncedQuery}
              shouldQuery={shouldQuery}
              onResultSelect={applyFilters}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SpotlightSearchDialog;

