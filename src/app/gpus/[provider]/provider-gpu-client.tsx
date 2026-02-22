"use client";

import { useQueryStates } from "nuqs";
import { searchParamsParser } from "@/features/data-explorer/table/search-params";
import { Client } from "@/features/data-explorer/table/client";
import * as React from "react";

/**
 * Thin wrapper that seeds the nuqs `provider` search param from the route segment
 * so the client-side table filter matches the server-prefetched data.
 *
 * Uses useLayoutEffect to push ?provider=X into the URL before the browser
 * paints, preventing a flash of unfiltered content.
 */
export function ProviderGpuClient({ provider }: { provider: string }) {
  const [search, setSearch] = useQueryStates(searchParamsParser);

  const hasSeeded = React.useRef(false);
  React.useLayoutEffect(() => {
    if (hasSeeded.current) return;
    hasSeeded.current = true;

    const currentProviders = search.provider;
    const alreadySet =
      Array.isArray(currentProviders) && currentProviders.includes(provider);

    if (!alreadySet) {
      setSearch({ provider: [provider] }, { shallow: true, history: "replace" });
    }
  }, [provider, search.provider, setSearch]);

  return <Client />;
}
