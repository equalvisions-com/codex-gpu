"use client";

import type { DataTableFilterField, SheetField } from "@/features/data-explorer/data-table/types";
import type { ToolColumnSchema } from "./tools-schema";
import { cn } from "@/lib/utils";
import Image from "next/image";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getToolProviderLogo } from "./tool-provider-logos";

const LogoBadge = ({
  src,
  alt,
  size,
  className,
}: {
  src?: string | null;
  alt?: string | null;
  size: number;
  className?: string;
}) => {
  const [loaded, setLoaded] = React.useState(false);
  const initial = alt?.charAt(0).toUpperCase() ?? "";

  return (
    <span
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-md border border-border/60 bg-background",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {!loaded ? <Skeleton className="absolute inset-0 h-full w-full animate-pulse" /> : null}
      {src ? (
        <Image
          src={src}
          alt=""
          aria-hidden="true"
          role="presentation"
          fill
          sizes={`${size}px`}
          className="object-contain"
          loading="lazy"
          onLoadingComplete={() => setLoaded(true)}
        />
      ) : initial ? (
        <span className="text-[10px] font-semibold uppercase text-foreground/70" aria-hidden="true">
          {initial}
        </span>
      ) : null}
    </span>
  );
};

export const toolsColumnOrder: string[] = [
  "blank",
  "name",
  "description",
  "developer",
  "stack",
  "price",
  "license",
  "category",
];

export const filterFields: DataTableFilterField<ToolColumnSchema>[] = [
  {
    label: "Search",
    value: "search",
    type: "input",
    defaultOpen: true,
    placeholder: "Search tools",
  },
  {
    label: "Categories",
    value: "category",
    type: "checkbox",
    defaultOpen: true,
  },
  {
    label: "Price",
    value: "price",
    type: "checkbox",
    defaultOpen: true,
  },
  {
    label: "Runtime",
    value: "stack",
    type: "checkbox",
    defaultOpen: true,
  },
  {
    label: "OSS",
    value: "oss",
    type: "checkbox",
    defaultOpen: true,
  },
  {
    label: "Developers",
    value: "developer",
    type: "checkbox",
    defaultOpen: true,
  },
  {
    label: "Licenses",
    value: "license",
    type: "checkbox",
    defaultOpen: true,
  },
];

export const sheetFields: SheetField<ToolColumnSchema>[] = [
  {
    id: "name",
    label: "Name",
    type: "readonly",
    hideLabel: true,
    fullRowValue: true,
    noPadding: true,
    component: (row) => {
      const logo = getToolProviderLogo(row.name);
      return (
        <div className="flex items-start gap-3">
          <LogoBadge
            src={logo?.src ?? null}
            alt={logo?.alt ?? row.name ?? "Tool"}
            size={40}
            className="h-10 w-10 shrink-0"
          />
          <div className="flex flex-col gap-0 leading-tight">
            <h2 className={cn("text-lg font-semibold leading-tight tracking-tight")}>
              {row.name || "Unknown Tool"}
            </h2>
            <p className="pb-4 text-sm text-foreground/70 leading-tight">
              {row.developer || "Unknown Developer"}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    id: "description",
    label: "Description",
    type: "readonly",
    hideLabel: true,
    fullRowValue: true,
    component: (row) =>
      row.description ? (
        <span className="text-sm text-foreground/90 leading-relaxed">{row.description}</span>
      ) : (
        <span className="text-muted-foreground">N/A</span>
      ),
  },
  {
    id: "stack",
    label: "Stack",
    type: "readonly",
    component: (row) => row.stack || "N/A",
  },
  {
    id: "price",
    label: "Price",
    type: "readonly",
    component: (row) => row.price || "N/A",
  },
  {
    id: "category",
    label: "Category",
    type: "readonly",
    component: (row) => row.category || "N/A",
  },
  {
    id: "developer",
    label: "Developer",
    type: "readonly",
    component: (row) => row.developer || "N/A",
  },
  {
    id: "oss",
    label: "OSS",
    type: "readonly",
    component: (row) => row.oss || "N/A",
  },
  {
    id: "license",
    label: "License",
    type: "readonly",
    component: (row) => row.license || "N/A",
  },
] as const;
