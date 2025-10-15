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

export const modelsSearchParamsParser = {
  // AI MODELS FILTERS
  provider: parseAsArrayOf(parseAsString, ARRAY_DELIMITER),
  author: parseAsArrayOf(parseAsString, ARRAY_DELIMITER),
  inputModalities: parseAsArrayOf(parseAsString, ARRAY_DELIMITER),
  contextLength: parseAsArrayOf(parseAsFloat, SLIDER_DELIMITER),
  inputPrice: parseAsArrayOf(parseAsFloat, SLIDER_DELIMITER),
  outputPrice: parseAsArrayOf(parseAsFloat, SLIDER_DELIMITER),
  search: parseAsString,
  name: parseAsString,
  description: parseAsString,
  // REQUIRED FOR SORTING & PAGINATION
  sort: parseAsSort,
  size: parseAsInteger.withDefault(50),
  start: parseAsInteger.withDefault(0),
  // REQUIRED FOR INFINITE SCROLLING (Load More)
  direction: parseAsStringLiteral(["prev", "next"]).withDefault("next"),
  cursor: parseAsInteger, // numeric offset cursor (server-driven)
  // REQUIRED FOR ROW SELECTION
  uuid: parseAsString,
};

export const modelsSearchParamsSerializer = createSerializer(modelsSearchParamsParser);

export type ModelsSearchParamsType = inferParserType<typeof modelsSearchParamsParser>;

export const modelsSearchParamsCache = createSearchParamsCache(modelsSearchParamsParser);
