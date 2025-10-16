"use client";

import { DataTableFilterControlsDrawer } from "@/components/data-table/data-table-filter-controls-drawer";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { Checkbox } from "@/components/ui/checkbox";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { HoverCardPortal } from "@radix-ui/react-hover-card";
import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import type { ModelsColumnSchema } from "./models-schema";

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
        <div className="max-w-[500px] truncate font-medium">
          {name}
        </div>
      );
    },
    size: 250,
    minSize: 250,
    maxSize: 500,
  },
  {
    accessorKey: "contextLength",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Context" titleClassName="ml-auto text-right" />
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
        <div className="font-mono text-sm text-right">
          {formatContextLength(contextLength)} <span className="text-foreground/70">TOK</span>
        </div>
      );
    },
    filterFn: "inNumberRange",
    size: 155,
    minSize: 155,
    meta: {
      cellClassName: "text-right min-w-[155px]",
      headerClassName: "text-right min-w-[155px]",
    },
  },
  {
    accessorKey: "inputModalities",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Modality" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const inputModalities = row.original.inputModalities ?? [];
      const outputModalities = row.original.outputModalities ?? [];
      const hasModalities = inputModalities.length + outputModalities.length > 0;

      if (!hasModalities) {
        return <span className="text-foreground/70">-</span>;
      }

      const uniqueModalities = new Set([...inputModalities, ...outputModalities]);
      const label = uniqueModalities.size > 1 ? "Multimodal" : "Unimodal";
      const formatList = (modalities: string[]) => (
        modalities.length
          ? modalities.map(modality => modality.charAt(0).toUpperCase() + modality.slice(1)).join(", ")
          : "-"
      );

      return (
        <HoverCard openDelay={0} closeDelay={0}>
          <HoverCardTrigger asChild>
            <div className="text-sm text-right font-medium tracking-wide cursor-pointer">
              {label}
            </div>
          </HoverCardTrigger>
          <HoverCardPortal>
            <HoverCardContent side="bottom" sideOffset={8} className="w-fit max-w-[155px] text-left text-xs space-y-1.5 p-2">
              <div>
                <span className="font-semibold text-foreground">Input:</span>{" "}
                <span className="text-foreground/80">{formatList(inputModalities)}</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Output:</span>{" "}
                <span className="text-foreground/80">{formatList(outputModalities)}</span>
              </div>
            </HoverCardContent>
          </HoverCardPortal>
        </HoverCard>
      );
    },
    size: 155,
    minSize: 155,
    meta: {
      cellClassName: "text-right min-w-[155px]",
      headerClassName: "text-right min-w-[155px]",
    },
  },
  {
    id: "inputPrice",
    accessorFn: (row) => row.pricing?.prompt || 0,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Prompt" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const pricing = row.original.pricing;
      const inputPrice = pricing?.prompt;

      const formattedPrice = formatPricePerMillion(inputPrice);

      return (
        <div className="text-right">
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
      cellClassName: "text-right min-w-[155px]",
      headerClassName: "text-right min-w-[155px]",
    },
  },
  {
    id: "outputPrice",
    accessorFn: (row) => row.pricing?.completion || 0,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Output" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const pricing = row.original.pricing;
      const outputPrice = pricing?.completion;

      const formattedPrice = formatPricePerMillion(outputPrice);

      return (
        <div className="text-right">
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
      cellClassName: "text-right min-w-[155px]",
      headerClassName: "text-right min-w-[155px]",
    },
  },
];
