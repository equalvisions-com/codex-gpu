"use client";

import { useQueryStates } from "nuqs";
import { modelsSearchParamsParser } from "@/features/data-explorer/models/models-search-params";
import { ModelsClient } from "@/features/data-explorer/models/models-client";
import * as React from "react";

/**
 * Thin wrapper that seeds the nuqs `provider` search param from the route segment
 * so the client-side table filter matches the server-prefetched data.
 *
 * Uses useLayoutEffect to push ?provider=X into the URL before the browser
 * paints, preventing a flash of unfiltered content.
 */
export function ProviderLlmClient({ provider }: { provider: string }) {
  const [search, setSearch] = useQueryStates(modelsSearchParamsParser);

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

  return <ModelsClient />;
}
