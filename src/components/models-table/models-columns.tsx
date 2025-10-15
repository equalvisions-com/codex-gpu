"use client";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { DataTableFilterControlsDrawer } from "@/components/data-table/data-table-filter-controls-drawer";
import type { ColumnDef } from "@tanstack/react-table";
import type { ModelsColumnSchema } from "./models-schema";
import Image from "next/image";

function RowCheckboxCell({ rowId }: { rowId: string }) {
  const { checkedRows, toggleCheckedRow } = useDataTable<ModelsColumnSchema, unknown>();
  const isChecked = checkedRows[rowId] ?? false;
  return (
    <Checkbox
      checked={isChecked}
      onCheckedChange={(next) => toggleCheckedRow(rowId, Boolean(next))}
      aria-label={`Check row ${rowId}`}
    />
  );
}

function formatPricePerMillion(price: string | number | undefined): string {
  if (price === undefined || price === null) return 'Free';

  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numericPrice) || numericPrice === 0) return 'Free';

  // Convert from per-token to per-million-tokens
  const perMillion = numericPrice * 1_000_000;

  // Format with 2 decimal places
  return `$${perMillion.toFixed(2)}`;
}

export const modelsColumns: ColumnDef<ModelsColumnSchema>[] = [
  {
    id: "blank",
    header: () => (
      <div className="flex items-center justify-center">
        <DataTableFilterControlsDrawer />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    cell: ({ row }) => {
      const stop = (e: any) => e.stopPropagation();
      return (
        <div
          className="flex h-full items-center justify-center"
          onClick={stop}
          onMouseDown={stop}
          onPointerDown={stop}
          onKeyDown={stop}
        >
          <RowCheckboxCell rowId={row.id} />
        </div>
      );
    },
    size: 45,
    minSize: 45,
    maxSize: 45,
    meta: {
      cellClassName: "min-w-[45px] p-0 text-center",
      headerClassName: "min-w-[45px]",
    },
  },
  {
    accessorKey: "provider",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Provider" />
    ),
    cell: ({ row }) => {
      const provider = row.getValue<ModelsColumnSchema["provider"]>("provider");
      return (
        <div className="flex items-center gap-2">
          {provider === "Anthropic" && (
            <Image src="/logos/Anthropic.svg" alt="Anthropic" width={20} height={20} className="rounded" />
          )}
          {provider === "Alibaba" && (
            <Image src="/logos/alibaba.png" alt="Alibaba" width={20} height={20} className="rounded" />
          )}
          {provider === "Amazon Bedrock" && (
            <Image src="/logos/Bedrock.svg" alt="Amazon Bedrock" width={20} height={20} className="rounded" />
          )}
          {provider === "AI21" && (
            <Image src="/logos/ai21.png" alt="AI21" width={20} height={20} className="rounded" />
          )}
          {provider === "AionLabs" && (
            <Image src="/logos/aionlabs.png" alt="AionLabs" width={20} height={20} className="rounded" />
          )}
          {provider === "AtlasCloud" && (
            <Image src="/logos/atlascloud.png" alt="AtlasCloud" width={20} height={20} className="rounded" />
          )}
          {provider === "Azure" && (
            <Image src="/logos/Azure.svg" alt="Azure" width={20} height={20} className="rounded" />
          )}
          {provider === "BaseTen" && (
            <Image src="/logos/baseten.svg" alt="BaseTen" width={20} height={20} className="rounded" />
          )}
          {provider === "Cerebras" && (
            <Image src="/logos/cerebras.png" alt="Cerebras" width={20} height={20} className="rounded" />
          )}
          {provider === "Chutes" && (
            <Image src="/logos/chutes.png" alt="Chutes" width={20} height={20} className="rounded" />
          )}
          {provider === "Cohere" && (
            <Image src="/logos/Cohere.png" alt="Cohere" width={20} height={20} className="rounded" />
          )}
          {provider === "Cloudflare" && (
            <Image src="/logos/cloudflare.png" alt="Cloudflare" width={20} height={20} className="rounded" />
          )}
          {provider === "Crusoe" && (
            <Image src="/logos/crusoe.png" alt="Crusoe" width={20} height={20} className="rounded" />
          )}
          {provider === "DeepSeek" && (
            <Image src="/logos/deepseek.png" alt="Deepseek" width={20} height={20} className="rounded" />
          )}
          {provider === "DeepInfra" && (
            <Image src="/logos/deepinfra.png" alt="DeepInfra" width={20} height={20} className="rounded" />
          )}
          {provider === "Featherless" && (
            <Image src="/logos/featherless.svg" alt="Featherless" width={20} height={20} className="rounded" />
          )}
          {provider === "Fireworks" && (
            <Image src="/logos/Fireworks.png" alt="Fireworks" width={20} height={20} className="rounded" />
          )}
          {provider === "Friendli" && (
            <Image src="/logos/friendli.png" alt="Friendli" width={20} height={20} className="rounded" />
          )}
          {provider === "GMICloud" && (
            <Image src="/logos/gmicloud.png" alt="GMICloud" width={20} height={20} className="rounded" />
          )}
          {provider === "Google AI Studio" && (
            <Image src="/logos/GoogleAIStudio.png" alt="Google AI Studio" width={20} height={20} className="rounded" />
          )}
          {provider === "Groq" && (
            <Image src="/logos/groq.png" alt="Groq" width={20} height={20} className="rounded" />
          )}
          {provider === "Z.AI" && (
            <Image src="/logos/zai.png" alt="Z.AI" width={20} height={20} className="rounded" />
          )}
          {provider === "xAI" && (
            <Image src="/logos/xai.png" alt="xAI" width={20} height={20} className="rounded" />
          )}
          {provider === "Together" && (
            <Image src="/logos/together.svg" alt="Together" width={20} height={20} className="rounded" />
          )}
          {provider === "Perplexity" && (
            <Image src="/logos/Perplexity.svg" alt="Perplexity" width={20} height={20} className="rounded" />
          )}
          {provider === "Weights and Biases" && (
            <Image src="/logos/wandb.png" alt="Weights and Biases" width={20} height={20} className="rounded" />
          )}
          {provider === "Google Vertex" && (
            <Image src="/logos/GoogleVertex.png" alt="Google Vertex" width={20} height={20} className="rounded" />
          )}
          {provider === "Hyperbolic" && (
            <Image src="/logos/hyperbolic.png" alt="Hyperbolic" width={20} height={20} className="rounded" />
          )}
          {provider === "Meta" && (
            <Image src="/logos/meta.png" alt="Meta" width={20} height={20} className="rounded" />
          )}
          {provider === "Mistral" && (
            <Image src="/logos/Mistral.png" alt="Mistral" width={20} height={20} className="rounded" />
          )}
          {provider === "Inception" && (
            <Image src="/logos/inception.png" alt="Inception" width={20} height={20} className="rounded" />
          )}
          {provider === "OpenAI" && (
            <Image src="/logos/openai.png" alt="OpenAI" width={20} height={20} className="rounded" />
          )}
          {provider === "Nebius" && (
            <Image src="/logos/nebius.png" alt="Nebius" width={20} height={20} className="rounded" />
          )}
          {provider === "Novita" && (
            <Image src="/logos/novita.jpeg" alt="Novita" width={20} height={20} className="rounded" />
          )}
          {provider === "InferenceNet" && (
            <Image src="/logos/inferencenet.png" alt="InferenceNet" width={20} height={20} className="rounded" />
          )}
          {provider === "Nvidia" && (
            <Image src="/logos/nvidia.png" alt="NVIDIA" width={20} height={20} className="rounded" />
          )}
          {provider === "Infermatic" && (
            <Image src="/logos/infermatic.png" alt="Infermatic" width={20} height={20} className="rounded" />
          )}
          {provider === "Inflection" && (
            <Image src="/logos/inflection.png" alt="Inflection" width={20} height={20} className="rounded" />
          )}
          {provider === "Liquid" && (
            <Image src="/logos/liquid.png" alt="Liquid" width={20} height={20} className="rounded" />
          )}
          {provider === "Mancer" && (
            <Image src="/logos/mancer.svg" alt="Mancer" width={20} height={20} className="rounded" />
          )}
          {provider === "MiniMax" && (
            <Image src="/logos/minimax.png" alt="Minimax" width={20} height={20} className="rounded" />
          )}
          {
            provider === "OpenInference" && (
            <Image src="/logos/openinference.png" alt="OpenInference" width={20} height={20} className="rounded" />
          )}
          {
            provider === "Parasail" && (
            <Image src="/logos/parasail.png" alt="Parasail" width={20} height={20} className="rounded" />
          )}
          {
            provider === "Phala" && (
            <Image src="/logos/phala.png" alt="Phala" width={20} height={20} className="rounded" />
          )}
          {
            provider === "MoonshotAI" && (
            <Image src="/logos/moonshot.png" alt="Moonshot AI" width={20} height={20} className="rounded" />
          )}
          {
            provider === "NCompass" && (
            <Image src="/logos/ncompass.png" alt="nCompass" width={20} height={20} className="rounded" />
          )}
          {
            provider === "Morph" && (
            <Image src="/logos/morph.png" alt="Morph" width={20} height={20} className="rounded" />
          )}
          {
            provider === "NextBit" && (
            <Image src="/logos/nextbit.png" alt="Nextbit" width={20} height={20} className="rounded" />
          )}
          {
            provider === "Relace" && (
            <Image src="/logos/relace.png" alt="Relace" width={20} height={20} className="rounded" />
          )}
          {
            provider === "SambaNova" && (
            <Image src="/logos/sambanova.png" alt="SambaNova" width={20} height={20} className="rounded" />
          )}
          {
            provider === "SiliconFlow" && (
            <Image src="/logos/siliconflow.png" alt="SiliconFlow" width={20} height={20} className="rounded" />
          )}
          {
            provider === "Switchpoint" && (
            <Image src="/logos/switchpoint.png" alt="Switchpoint" width={20} height={20} className="rounded" />
          )}
          {
            provider === "Targon" && (
            <Image src="/logos/targon.svg" alt="Targon" width={20} height={20} className="rounded" />
          )}
          {
            provider === "Venice" && (
            <Image src="/logos/venice.png" alt="Venice" width={20} height={20} className="rounded" />
          )}
          <span>{provider}</span>
        </div>
      );
    },
    size: 180,
    minSize: 180,
    meta: {
      cellClassName: "text-left min-w-[180px]",
      headerClassName: "text-left min-w-[180px]",
    },
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Model" />
    ),
    cell: ({ row }) => {
      const name = row.getValue<ModelsColumnSchema["name"]>("name");

      if (!name) return <span className="text-muted-foreground">Unknown</span>;

      return (
        <div className="max-w-[300px] truncate font-medium">
          {name}
        </div>
      );
    },
    size: 250,
    minSize: 200,
    maxSize: 400,
  },
  {
    accessorKey: "contextLength",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Context" centerTitle />
    ),
    cell: ({ row }) => {
      const contextLength = row.original.contextLength;

      if (!contextLength) return <span className="text-muted-foreground">-</span>;

      // Format large numbers (e.g., 256000 -> 256K, 1000000 -> 1M)
      const formatContextLength = (length: number): string => {
        if (length >= 1_000_000) {
          return `${(length / 1_000_000).toFixed(1)}M`;
        } else if (length >= 1000) {
          return `${(length / 1000).toFixed(0)}K`;
        }
        return length.toString();
      };

      return (
        <div className="font-mono text-sm text-center">
          {formatContextLength(contextLength)} <span className="text-foreground/70">Tokens</span>
        </div>
      );
    },
    filterFn: "inNumberRange",
    size: 155,
    minSize: 155,
    meta: {
      cellClassName: "text-center min-w-[155px]",
      headerClassName: "text-center min-w-[155px]",
    },
  },
  {
    accessorKey: "outputModalities",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Modalities" centerTitle />
    ),
    cell: ({ row }) => {
      const modalities = row.original.outputModalities;

      if (!modalities || modalities.length === 0) {
        return <span className="text-foreground/70">-</span>;
      }

      // Sort modalities so text comes first, then image, then others
      const sortedModalities = [...modalities].sort((a, b) => {
        const order = { text: 0, image: 1 };
        const aOrder = order[a as keyof typeof order] ?? 2;
        const bOrder = order[b as keyof typeof order] ?? 2;
        return aOrder - bOrder;
      });

      return (
        <div className="text-sm text-center">
          {sortedModalities.map(mod => mod.charAt(0).toUpperCase() + mod.slice(1)).join("/")}
        </div>
      );
    },
    size: 155,
    minSize: 155,
    meta: {
      cellClassName: "text-center min-w-[155px]",
      headerClassName: "text-center min-w-[155px]",
    },
  },
  {
    id: "inputPrice",
    accessorFn: (row) => row.pricing?.prompt || 0,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Input" centerTitle />
    ),
    cell: ({ row }) => {
      const pricing = row.original.pricing;
      const inputPrice = pricing?.prompt;

      const formattedPrice = formatPricePerMillion(inputPrice);

      return (
        <div className="text-center">
          {formattedPrice === 'Free' ? (
            <span className="font-mono text-foreground/70">Free</span>
          ) : (
            <>
              <span className="font-mono">{formattedPrice}</span>{" "}
              <span className="font-mono text-foreground/70">/M</span>
            </>
          )}
        </div>
      );
    },
    filterFn: "inNumberRange",
    size: 155,
    minSize: 155,
    meta: {
      cellClassName: "text-center min-w-[155px]",
      headerClassName: "text-center min-w-[155px]",
    },
  },
  {
    id: "outputPrice",
    accessorFn: (row) => row.pricing?.completion || 0,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Output" centerTitle />
    ),
    cell: ({ row }) => {
      const pricing = row.original.pricing;
      const outputPrice = pricing?.completion;

      const formattedPrice = formatPricePerMillion(outputPrice);

      return (
        <div className="text-center">
          {formattedPrice === 'Free' ? (
            <span className="font-mono text-foreground/70">Free</span>
          ) : (
            <>
              <span className="font-mono">{formattedPrice}</span>{" "}
              <span className="font-mono text-foreground/70">/M</span>
            </>
          )}
        </div>
      );
    },
    filterFn: "inNumberRange",
    size: 155,
    minSize: 155,
    meta: {
      cellClassName: "text-center min-w-[155px]",
      headerClassName: "text-center min-w-[155px]",
    },
  },
];
