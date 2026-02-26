"use client";

import { useQueryStates } from "nuqs";
import { useRouter, useSearchParams } from "next/navigation";
import { searchParamsParser } from "@/features/data-explorer/table/search-params";
import { Client } from "@/features/data-explorer/table/client";
import * as React from "react";

/**
 * Thin wrapper that seeds the nuqs `gpu_model` search param from the route segment
 * so the client-side table filter matches the server-prefetched data.
 *
 * Uses useLayoutEffect to push ?gpu_model=X into the URL before the browser
 * paints, preventing a flash of unfiltered content.
 *
 * If the user clears the gpu_model filter, redirects to /gpus.
 * Uses Next.js useSearchParams to watch the actual browser URL rather than
 * relying on nuqs internal state or render counting.
 */
export function ModelGpuClient({ gpuModel }: { gpuModel: string }) {
  const [search, setSearch] = useQueryStates(searchParamsParser);
  const router = useRouter();
  const searchParams = useSearchParams();

  const hasSeeded = React.useRef(false);

  React.useLayoutEffect(() => {
    if (hasSeeded.current) return;
    hasSeeded.current = true;

    const currentModels = search.gpu_model;
    const alreadySet =
      Array.isArray(currentModels) && currentModels.includes(gpuModel);

    if (!alreadySet) {
      setSearch(
        { gpu_model: [gpuModel] },
        { shallow: true, history: "replace" },
      );
    }
  }, [gpuModel, search.gpu_model, setSearch]);

  // Watch the actual browser URL. Once seeded, if `gpu_model` disappears
  // from the query string, the user cleared the filter — redirect to /gpus.
  React.useEffect(() => {
    if (!hasSeeded.current) return;
    const urlModel = searchParams.get("gpu_model");
    if (!urlModel) {
      router.replace("/gpus");
    }
  }, [searchParams, router]);

  return <Client />;
}
