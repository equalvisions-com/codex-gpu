"use client";

import { useQueryStates } from "nuqs";
import { useRouter } from "next/navigation";
import { modelsSearchParamsParser } from "@/features/data-explorer/models/models-search-params";
import { ModelsClient } from "@/features/data-explorer/models/models-client";
import * as React from "react";

/**
 * Thin wrapper that seeds the nuqs `provider` search param from the route segment
 * so the client-side table filter matches the server-prefetched data.
 *
 * Uses useLayoutEffect to push ?provider=X into the URL before the browser
 * paints, preventing a flash of unfiltered content.
 *
 * If the user clears the provider filter, redirects to /llms.
 */
export function ProviderLlmClient({ provider }: { provider: string }) {
  const [search, setSearch] = useQueryStates(modelsSearchParamsParser);
  const router = useRouter();

  const hasSeeded = React.useRef(false);
  const renderCount = React.useRef(0);

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

  // Redirect to /llms if the user clears the provider filter.
  // Skip the first 2 renders to avoid redirecting before the seed takes effect.
  React.useEffect(() => {
    renderCount.current += 1;
    if (renderCount.current <= 2) return;

    const providerFilter = search.provider;
    const isEmpty = !providerFilter || (Array.isArray(providerFilter) && providerFilter.length === 0);
    if (isEmpty) {
      router.replace("/llms");
    }
  }, [search.provider, router]);

  return <ModelsClient />;
}
