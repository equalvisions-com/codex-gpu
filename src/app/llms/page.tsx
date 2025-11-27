import type { Metadata } from "next";
import { Suspense } from "react";
import { ModelsDataStreamInner } from "@/features/data-explorer/models/models-data-stream";
import { DataStreamLoading } from "@/features/data-explorer/table/data-stream-loading";

const LLMS_META_TITLE = "LLM Benchmark Explorer | Deploybase";
const LLMS_META_DESCRIPTION =
  "Filter and benchmark large language models by latency, throughput, modality support, and pricing using our interactive table experience.";
const SHARED_OG_IMAGE = "/assets/data-table-infinite.png";

export function generateMetadata(): Metadata {
  return {
    title: LLMS_META_TITLE,
    description: LLMS_META_DESCRIPTION,
    openGraph: {
      title: LLMS_META_TITLE,
      description: LLMS_META_DESCRIPTION,
      url: "/llms",
      images: [SHARED_OG_IMAGE],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: LLMS_META_TITLE,
      description: LLMS_META_DESCRIPTION,
      images: [SHARED_OG_IMAGE],
    },
  };
}

// Page shell is static and prerendered with PPR
// Only the Suspense-wrapped dynamic content streams
export default function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<DataStreamLoading />}>
      <ModelsDataStreamInner searchParams={searchParams} />
    </Suspense>
  );
}
