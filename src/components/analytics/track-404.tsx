"use client";

import { useEffect, useRef } from "react";
import { useAnalytics } from "@/lib/analytics";

// [Analytics] Track 404 page views
export function Track404() {
  const plausible = useAnalytics();
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;
    plausible("404");
  }, [plausible]);

  return null;
}
