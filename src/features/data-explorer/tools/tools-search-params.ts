import {
  createParser,
  createSearchParamsCache,
  createSerializer,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  type inferParserType,
} from "nuqs/server";
import { ARRAY_DELIMITER, SORT_DELIMITER } from "@/lib/delimiters";

const parseAsSort = createParser({
  parse(queryValue) {
    const [id, desc] = queryValue.split(SORT_DELIMITER);
    if (!id && !desc) return null;
    return { id, desc: desc === "desc" };
  },
  serialize(value) {
    return `${value.id}.${value.desc ? "desc" : "asc"}`;
  },
});

export const toolsSearchParamsParser = {
  developer: parseAsArrayOf(parseAsString, ARRAY_DELIMITER),
  category: parseAsArrayOf(parseAsString, ARRAY_DELIMITER),
  price: parseAsArrayOf(parseAsString, ARRAY_DELIMITER),
  license: parseAsArrayOf(parseAsString, ARRAY_DELIMITER),
  stack: parseAsArrayOf(parseAsString, ARRAY_DELIMITER),
  oss: parseAsArrayOf(parseAsString, ARRAY_DELIMITER),
  search: parseAsString,
  bookmarks: parseAsString,
  sort: parseAsSort,
  size: parseAsInteger.withDefault(50),
  cursor: parseAsInteger,
  uuid: parseAsString,
};

export const toolsSearchParamsSerializer = createSerializer(toolsSearchParamsParser);
export const toolsSearchParamsCache = createSearchParamsCache(toolsSearchParamsParser);
export type ToolsSearchParamsType = inferParserType<typeof toolsSearchParamsParser>;
