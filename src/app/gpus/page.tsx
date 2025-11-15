import * as React from "react";
import { Suspense } from "react";
import { Client } from "@/components/infinite-table/client";

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
    <div className="flex min-h-dvh w-full items-center justify-center text-sm text-muted-foreground">

    </div>
  );
}
