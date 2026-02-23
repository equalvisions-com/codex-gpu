"use client";

import { useQueryStates } from "nuqs";
import { useRouter, useSearchParams } from "next/navigation";
import { searchParamsParser } from "@/features/data-explorer/table/search-params";
import { Client } from "@/features/data-explorer/table/client";
import * as React from "react";

/**
 * Thin wrapper that seeds the nuqs `provider` search param from the route segment
 * so the client-side table filter matches the server-prefetched data.
 *
 * Uses useLayoutEffect to push ?provider=X into the URL before the browser
 * paints, preventing a flash of unfiltered content.
 *
 * If the user clears the provider filter, redirects to /gpus.
 * Uses Next.js useSearchParams to watch the actual browser URL rather than
 * relying on nuqs internal state or render counting.
 */
export function ProviderGpuClient({ provider }: { provider: string }) {
  const [search, setSearch] = useQueryStates(searchParamsParser);
  const router = useRouter();
  const searchParams = useSearchParams();

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

  // Watch the actual browser URL. Once seeded, if `provider` disappears
  // from the query string, the user cleared the filter — redirect to /gpus.
  React.useEffect(() => {
    if (!hasSeeded.current) return;
    const urlProvider = searchParams.get("provider");
    if (!urlProvider) {
      router.replace("/gpus");
    }
  }, [searchParams, router]);

  return <Client />;
}
