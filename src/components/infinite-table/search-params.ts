import {
  createParser,
  createSearchParamsCache,
  createSerializer,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  parseAsTimestamp,
  type inferParserType,
} from "nuqs/server";
// Note: import from 'nuqs/server' to avoid the "use client" directive
import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
  SORT_DELIMITER,
} from "@/lib/delimiters";

// https://logs.run/i?sort=hourlyRate.desc

export const parseAsSort = createParser({
  parse(queryValue) {
    const [id, desc] = queryValue.split(SORT_DELIMITER);
    if (!id && !desc) return null;
    return { id, desc: desc === "desc" };
  },
  serialize(value) {
    return `${value.id}.${value.desc ? "desc" : "asc"}`;
  },
});

export const searchParamsParser = {
  // GPU PRICING FILTERS
  provider: parseAsArrayOf(parseAsString, ARRAY_DELIMITER),
  gpu_model: parseAsString,
  gpu_count: parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  vram_gb: parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  vcpus: parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  system_ram_gb: parseAsArrayOf(parseAsInteger, SLIDER_DELIMITER),
  price_hour_usd: parseAsArrayOf(parseAsFloat, SLIDER_DELIMITER),
  observed_at: parseAsArrayOf(parseAsTimestamp, RANGE_DELIMITER),
  search: parseAsString,
  // REQUIRED FOR SORTING & PAGINATION
  sort: parseAsSort,
  size: parseAsInteger.withDefault(50),
  start: parseAsInteger.withDefault(0),
  // REQUIRED FOR INFINITE SCROLLING (Load More)
  direction: parseAsStringLiteral(["prev", "next"]).withDefault("next"),
  cursor: parseAsInteger, // numeric offset cursor (server-driven)
  // REQUIRED FOR SELECTION
  uuid: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParser);

export const searchParamsSerializer = createSerializer(searchParamsParser);

export type SearchParamsType = inferParserType<typeof searchParamsParser>;
