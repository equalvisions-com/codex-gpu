import type { Metadata } from "next";
import { Suspense } from "react";
import { GpuDataStreamInner } from "@/features/data-explorer/table/gpu-data-stream";
import { DataStreamLoading } from "@/features/data-explorer/table/data-stream-loading";

const GPU_META_TITLE = "GPU Pricing Explorer | Deploybase";
const GPU_META_DESCRIPTION =
  "Compare hourly GPU prices, VRAM, and provider availability with our infinite data table powered by TanStack Table, nuqs, and shadcn/ui.";
const SHARED_OG_IMAGE = "/assets/data-table-infinite.png";

export function generateMetadata(): Metadata {
  return {
    title: GPU_META_TITLE,
    description: GPU_META_DESCRIPTION,
    openGraph: {
      title: GPU_META_TITLE,
      description: GPU_META_DESCRIPTION,
      images: [SHARED_OG_IMAGE],
      url: "/gpus",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: GPU_META_TITLE,
      description: GPU_META_DESCRIPTION,
      images: [SHARED_OG_IMAGE],
    },
  };
}

// Page shell is static and prerendered with PPR
// Only the Suspense-wrapped dynamic content streams
export default function GpusPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<DataStreamLoading />}>
      <GpuDataStreamInner searchParams={searchParams} />
    </Suspense>
  );
}
