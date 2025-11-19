"use client";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTableHeaderCheckbox } from "@/components/data-table/data-table-header-checkbox";
import { useDataTable } from "@/components/data-table/data-table-provider";
import { Checkbox } from "@/components/ui/checkbox";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { HoverCardPortal } from "@radix-ui/react-hover-card";
import type { ColumnDef, SortingFn } from "@tanstack/react-table";
import Image from "next/image";
import type { ModelsColumnSchema } from "./models-schema";

export const MODEL_PROVIDER_LOGOS: Record<
  string,
  {
    src: string;
    alt: string;
  }
> = {
  Anthropic: { src: "/logos/Anthropic.svg", alt: "Anthropic" },
  Alibaba: { src: "/logos/alibaba.png", alt: "Alibaba" },
  "Amazon Bedrock": { src: "/logos/Bedrock.svg", alt: "Amazon Bedrock" },
  AI21: { src: "/logos/ai21.png", alt: "AI21" },
  AionLabs: { src: "/logos/aionlabs.png", alt: "AionLabs" },
  AtlasCloud: { src: "/logos/atlascloud.png", alt: "AtlasCloud" },
  Azure: { src: "/logos/Azure.svg", alt: "Azure" },
  BaseTen: { src: "/logos/baseten.svg", alt: "BaseTen" },
  Cerebras: { src: "/logos/cerebras.png", alt: "Cerebras" },
  Chutes: { src: "/logos/chutes.png", alt: "Chutes" },
  Cohere: { src: "/logos/Cohere.png", alt: "Cohere" },
  Cloudflare: { src: "/logos/cloudflare.png", alt: "Cloudflare" },
  Crusoe: { src: "/logos/crusoe.png", alt: "Crusoe" },
  DeepSeek: { src: "/logos/deepseek.png", alt: "DeepSeek" },
  DeepInfra: { src: "/logos/deepinfra.png", alt: "DeepInfra" },
  Featherless: { src: "/logos/featherless.svg", alt: "Featherless" },
  Fireworks: { src: "/logos/Fireworks.png", alt: "Fireworks" },
  Friendli: { src: "/logos/friendli.png", alt: "Friendli" },
  GMICloud: { src: "/logos/gmicloud.png", alt: "GMICloud" },
  "Google AI Studio": { src: "/logos/GoogleAIStudio.png", alt: "Google AI Studio" },
  Groq: { src: "/logos/groq.png", alt: "Groq" },
  "Z.AI": { src: "/logos/zai.png", alt: "Z.AI" },
  xAI: { src: "/logos/xai.png", alt: "xAI" },
  Together: { src: "/logos/together.svg", alt: "Together" },
  Perplexity: { src: "/logos/Perplexity.svg", alt: "Perplexity" },
  "Weights and Biases": { src: "/logos/wandb.png", alt: "Weights and Biases" },
  "Google Vertex": { src: "/logos/GoogleVertex.png", alt: "Google Vertex" },
  Hyperbolic: { src: "/logos/hyperbolic.png", alt: "Hyperbolic" },
  Meta: { src: "/logos/meta.png", alt: "Meta" },
  Mistral: { src: "/logos/Mistral.png", alt: "Mistral" },
  Inception: { src: "/logos/inception.png", alt: "Inception" },
  OpenAI: { src: "/logos/openai.png", alt: "OpenAI" },
  Nebius: { src: "/logos/nebius.png", alt: "Nebius" },
  Novita: { src: "/logos/novita.jpeg", alt: "Novita" },
  InferenceNet: { src: "/logos/inferencenet.png", alt: "InferenceNet" },
  NVIDIA: { src: "/logos/nvidia.png", alt: "NVIDIA" },
  Infermatic: { src: "/logos/infermatic.png", alt: "Infermatic" },
  Inflection: { src: "/logos/inflection.png", alt: "Inflection" },
  Liquid: { src: "/logos/liquid.png", alt: "Liquid" },
  Mancer: { src: "/logos/mancer.svg", alt: "Mancer" },
  MiniMax: { src: "/logos/minimax.png", alt: "MiniMax" },
  OpenInference: { src: "/logos/openinference.png", alt: "OpenInference" },
  Parasail: { src: "/logos/parasail.png", alt: "Parasail" },
  Phala: { src: "/logos/phala.png", alt: "Phala" },
  MoonshotAI: { src: "/logos/moonshot.png", alt: "Moonshot AI" },
  NCompass: { src: "/logos/ncompass.png", alt: "nCompass" },
  Morph: { src: "/logos/morph.png", alt: "Morph" },
  NextBit: { src: "/logos/nextbit.png", alt: "NextBit" },
  Relace: { src: "/logos/relace.png", alt: "Relace" },
  SambaNova: { src: "/logos/sambanova.png", alt: "SambaNova" },
  SiliconFlow: { src: "/logos/siliconflow.png", alt: "SiliconFlow" },
  Switchpoint: { src: "/logos/switchpoint.png", alt: "Switchpoint" },
  Targon: { src: "/logos/targon.svg", alt: "Targon" },
  Venice: { src: "/logos/venice.png", alt: "Venice" },
  Qwen: { src: "/logos/Qwen.png", alt: "Qwen" },
  Google: { src: "/logos/google.svg", alt: "Google" },
};

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

function formatPricePerMillion(price: string | number | null | undefined): string {
  if (price === undefined || price === null) return 'Free';

  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numericPrice) || numericPrice === 0) return 'Free';

  // Convert from per-token to per-million-tokens
  const perMillion = numericPrice * 1_000_000;

  // Format with 2 decimal places
  return `$${perMillion.toFixed(2)}`;
}

function formatMmluScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'N/A';
  return `${(score * 100).toFixed(1)}%`;
}

export const modelsColumns: ColumnDef<ModelsColumnSchema>[] = [
  {
    id: "blank",
    header: () => (
      <div className="flex items-center justify-center">
        <DataTableHeaderCheckbox />
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
      headerClassName: "min-w-[45px] px-0",
    },
  },
  {
    accessorKey: "provider",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Provider" />
    ),
    cell: ({ row }) => {
      const providerRaw = row.getValue<ModelsColumnSchema["provider"]>("provider") ?? "";
      const provider = typeof providerRaw === "string" ? providerRaw : "";
      const logo = MODEL_PROVIDER_LOGOS[provider];
      const fallbackInitial = provider ? provider.charAt(0).toUpperCase() : "";

      return (
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/40 bg-background">
            {logo ? (
              <Image
                src={logo.src}
                alt=""
                aria-hidden="true"
                role="presentation"
                fill
                sizes="20px"
                className="object-contain"
                loading="eager"
              />
            ) : fallbackInitial ? (
              <span className="text-[10px] font-semibold uppercase text-muted-foreground" aria-hidden="true">
                {fallbackInitial}
              </span>
            ) : null}
          </span>
          <span className="truncate" title={provider || undefined}>
            {provider || "Unknown"}
          </span>
        </div>
      );
    },
    size: 156,
    minSize: 156,
    meta: {
      cellClassName: "text-left min-w-[156px]",
      headerClassName: "text-left min-w-[156px]",
    },
  },
  {
    id: "name",
    accessorFn: (row) => (typeof row.shortName === "string" ? row.shortName : ""),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Model" />
    ),
    cell: ({ row }) => {
      const { shortName, name } = row.original;
      const primaryLabel = typeof shortName === "string" && shortName.trim().length
        ? shortName
        : name;

      if (!primaryLabel) {
        return <span className="text-muted-foreground">Unknown</span>;
      }

      return <div className="truncate">{primaryLabel}</div>;
    },
    size: 275,
    minSize: 275,
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
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
  {
    accessorKey: "mmlu",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="MMLU-Pro" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const score = row.original.mmlu;
      const formatted = formatMmluScore(score ?? null);
      const isMissing = formatted === "N/A";
      const hasPercent = formatted.endsWith("%");
      const numericPortion = hasPercent ? formatted.slice(0, -1) : formatted;
      return (
        <span
          className={cn(
            "block text-right font-mono text-sm tabular-nums",
            isMissing && "text-foreground/70",
          )}
        >
          {numericPortion}
          {hasPercent ? (
            <span className="text-foreground/70">%</span>
          ) : null}
        </span>
      );
    },
    enableSorting: true,
    sortingFn: "auto",
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px] tabular-nums",
      headerClassName: "text-right min-w-[150px] tabular-nums",
    },
  },
  {
    accessorKey: "maxCompletionTokens",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Max Output" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const maxTokens = row.original.maxCompletionTokens;

      if (!maxTokens) {
        return <span className="text-foreground/70">N/A</span>;
      }

      // Format large numbers (e.g., 96000 -> 96K, 1000000 -> 1M)
      const formatMaxTokens = (tokens: number): string => {
        if (tokens >= 1_000_000) {
          return `${(tokens / 1_000_000).toFixed(1)}M`;
        } else if (tokens >= 1000) {
          return `${(tokens / 1000).toFixed(0)}K`;
        }
        return tokens.toString();
      };

      return (
        <div className="font-mono text-sm text-right">
          {formatMaxTokens(maxTokens)} <span className="text-foreground/70">TOK</span>
        </div>
      );
    },
    filterFn: "inNumberRange",
    enableSorting: true,
    sortingFn: "auto",
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
  {
    id: "modalities",
    accessorKey: "inputModalities",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Modality" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const inputModalities = row.original.inputModalities ?? [];
      const outputModalities = row.original.outputModalities ?? [];
      const hasModalities = inputModalities.length + outputModalities.length > 0;

      const computedScore = row.original.modalityScore ?? new Set([
        ...inputModalities,
        ...outputModalities,
      ]).size;

      if (!hasModalities || computedScore === 0) {
        return <span className="text-foreground/70">-</span>;
      }

      const label = computedScore > 1 ? "Multimodal" : "Unimodal";
      const formatList = (modalities: string[]) => (
        modalities.length
          ? modalities.map(modality => modality.charAt(0).toUpperCase() + modality.slice(1)).join(", ")
          : "-"
      );

      return (
        <HoverCard openDelay={0} closeDelay={0}>
          <HoverCardTrigger asChild>
            <div className="text-sm text-right tracking-wide cursor-pointer">
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
    enableSorting: true,
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
  {
    id: "inputPrice",
    accessorKey: "promptPrice",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Prompt" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const inputPrice = row.original.promptPrice;

      const formattedPrice = formatPricePerMillion(inputPrice);

      return (
        <div className="text-right">
          {formattedPrice === 'Free' ? (
            <span className="font-mono text-foreground">Free</span>
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
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
  {
    id: "outputPrice",
    accessorKey: "completionPrice",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Output" titleClassName="ml-auto text-right" />
    ),
    cell: ({ row }) => {
      const outputPrice = row.original.completionPrice;

      const formattedPrice = formatPricePerMillion(outputPrice);

      return (
        <div className="text-right">
          {formattedPrice === 'Free' ? (
            <span className="font-mono text-foreground">Free</span>
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
    size: 150,
    minSize: 150,
    meta: {
      cellClassName: "text-right min-w-[150px]",
      headerClassName: "text-right min-w-[150px]",
    },
  },
];
