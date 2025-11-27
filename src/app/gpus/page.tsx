import type { Metadata } from "next";
import { Suspense } from "react";
import { GpuDataStreamInner } from "@/features/data-explorer/table/gpu-data-stream";
import { DataStreamLoading } from "@/features/data-explorer/table/data-stream-loading";

export const revalidate = 43200;
export const dynamic = "auto";
export const fetchCache = "default";
const GPU_META_TITLE = "GPU Pricing Explorer | Deploybase";
const GPU_META_DESCRIPTION =
  "Compare hourly GPU prices, VRAM, and provider availability with our infinite data table powered by TanStack Table, nuqs, and shadcn/ui.";
const SHARED_OG_IMAGE = "/assets/data-table-infinite.png";

export async function generateMetadata(): Promise<Metadata> {
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

export default function GpusPage() {
  return (
    <Suspense fallback={<DataStreamLoading />}>
      <GpuDataStreamInner />
    </Suspense>
  );
}
