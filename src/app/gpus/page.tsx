import * as React from "react";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Client } from "@/components/infinite-table/client";

export const revalidate = 43200;

export default function GpusPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <GpusContent />
    </Suspense>
  );
}

function GpusContent() {
  return (
    <div
      className="flex min-h-dvh w-full flex-col sm:flex-row pt-2 sm:p-0"
      style={{
        "--total-padding-mobile": "calc(0.5rem + 0.5rem)",
        "--total-padding-desktop": "3rem",
      } as React.CSSProperties}
    >
      <Client />
    </div>
  );
}

function PageFallback() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center">
      <span className="inline-flex items-center justify-center text-muted-foreground" aria-label="Loading">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" strokeWidth={1.5} />
        <span className="sr-only">Loading</span>
      </span>
    </div>
  );
}
