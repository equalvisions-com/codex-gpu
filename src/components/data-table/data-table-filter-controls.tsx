"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/custom/accordion";
import * as React from "react";
import { DataTableFilterResetButton } from "./data-table-filter-reset-button";
import { DataTableFilterCheckbox } from "./data-table-filter-checkbox";
import { DataTableFilterSlider } from "./data-table-filter-slider";
import { DataTableFilterInput } from "./data-table-filter-input";
import { useDataTable } from "@/components/data-table/data-table-provider";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-client-provider";
import { useAuthDialog } from "@/providers/auth-dialog-provider";
import { ModalitiesFilter } from "@/components/models-table/modalities-filter";
import { usePathname } from "next/navigation";

interface SidebarItemProps {
  href: string;
  label: string;
  isActive?: boolean;
}

function SidebarLink({ href, label, isActive }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors text-foreground hover:bg-muted/50 hover:text-accent-foreground",
        isActive ? "bg-muted/50 text-accent-foreground" : null,
      )}
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarAction({ label, onClick }: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors text-foreground hover:bg-muted/50 hover:text-accent-foreground",
      )}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

export function DataTableFilterControls() {
  const { filterFields } = useDataTable();
  const { session } = useAuth();
  const { showSignIn } = useAuthDialog();
  const pathname = usePathname();
  const normalizedPath = pathname ?? "";

  const searchFilter = filterFields?.find((field) => field.value === "search");
  const otherFilters = filterFields?.filter((field) => field.value !== "search");

  const defaultAccordionValues = React.useMemo(
    () => [
      "navigation",
      ...(otherFilters
        ?.filter(({ defaultOpen }) => defaultOpen)
        ?.map(({ value }) => value as string) ?? []),
    ],
    [otherFilters],
  );

  const handleSignIn = React.useCallback(() => {
    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/";
    showSignIn({ callbackUrl });
  }, [showSignIn]);

  const isLLMsActive = normalizedPath.startsWith("/models");
  const isGpuActive = normalizedPath === "/" || normalizedPath.startsWith("/gpus");
  const isToolsActive = normalizedPath.startsWith("/cpus");
  const isFavoritesActive = normalizedPath.startsWith("/favorites");

  return (
    <>
      {searchFilter && searchFilter.type === "input" ? (
        <div className="mb-6">
          <DataTableFilterInput {...searchFilter} />
        </div>
      ) : null}

      <Accordion type="multiple" defaultValue={defaultAccordionValues}>
        <AccordionItem value="navigation" className="border-none mb-4 last:mb-0">
          <AccordionTrigger className="w-full py-0 hover:no-underline data-[state=closed]:text-muted-foreground data-[state=open]:text-foreground focus-within:data-[state=closed]:text-foreground hover:data-[state=closed]:text-foreground [&>svg]:text-foreground/70">
            <div className="flex w-full items-center justify-between gap-2 truncate pb-2 pr-2">
              <div className="flex items-center gap-2 truncate">
                <p className="text-sm font-semibold text-foreground/70">Navigation</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="[&>div]:pb-0">
            <div className="p-1">
              <div className="space-y-1">
                <SidebarLink href="/models" label="LLMs" isActive={isLLMsActive} />
                <SidebarLink href="/" label="GPUs" isActive={isGpuActive} />
                <SidebarLink href="/cpus" label="Tools" isActive={isToolsActive} />
                {session ? (
                  <SidebarLink href="/favorites" label="Favorites" isActive={isFavoritesActive} />
                ) : (
                  <SidebarAction label="Sign in" onClick={handleSignIn} />
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {otherFilters?.map((field) => {
          const value = field.value as string;
          return (
            <AccordionItem
              key={value}
              value={value}
              className="border-none mb-4 last:mb-0"
            >
              <AccordionTrigger className="w-full py-0 hover:no-underline data-[state=closed]:text-muted-foreground data-[state=open]:text-foreground focus-within:data-[state=closed]:text-foreground hover:data-[state=closed]:text-foreground [&>svg]:text-foreground/70">
                <div className="flex w-full items-center justify-between gap-2 truncate pb-2 pr-2">
                  <div className="flex items-center gap-2 truncate">
                    <p className="text-sm font-semibold text-foreground/70">{field.label}</p>
                  </div>
                  <DataTableFilterResetButton {...field} />
                </div>
              </AccordionTrigger>
              <AccordionContent className={cn(
                field.type === "slider" ? "[&>div]:pb-[2px]" : "[&>div]:pb-0"
              )}>
                <div
                  className={cn(
                    "p-1",
                    field.type === "slider" ? "px-1 pt-1 pb-0" : null,
                  )}
                >
                  {(() => {
                    if (value === "modalities") {
                      return <ModalitiesFilter />;
                    }

                    switch (field.type) {
                      case "checkbox": {
                        return <DataTableFilterCheckbox {...field} />;
                      }
                      case "slider": {
                        return <DataTableFilterSlider {...field} />;
                      }
                      case "input": {
                        return <DataTableFilterInput {...field} />;
                      }
                    }
                  })()}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </>
  );
}
