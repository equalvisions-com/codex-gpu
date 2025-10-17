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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-client-provider";
import { useAuthDialog } from "@/providers/auth-dialog-provider";
import { ModalitiesFilter } from "@/components/models-table/modalities-filter";

interface DataTableFilterControlsProps {
  currentView?: "gpus" | "cpus";
}

function SidebarLink({ href, label, onClick, disabled, active }: {
  href?: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const baseClasses =
    "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors text-foreground hover:bg-muted/50 hover:text-accent-foreground";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          baseClasses,
          "text-left",
          disabled ? "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-foreground" : null,
          active ? "bg-muted/50 text-accent-foreground" : null,
        )}
      >
        <span className="truncate">{label}</span>
      </button>
    );
  }

  if (!href) return null;

  return (
    <Link
      href={href}
      className={cn(baseClasses, active ? "bg-muted/50 text-accent-foreground" : null)}
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function DataTableFilterControls({ currentView = "gpus" }: DataTableFilterControlsProps = {}) {
  const { filterFields } = useDataTable();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { session } = useAuth();
  const { showSignIn } = useAuthDialog();

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

  const handleFavoritesClick = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("favorites", "true");
    const baseUrl = currentView === "cpus" ? "/cpus" : "";
    router.push(`${baseUrl}?${params.toString()}`, { scroll: false });
  }, [currentView, router, searchParams]);

  const handleCurrentViewClick = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("favorites");
    const baseUrl = currentView === "cpus" ? "/cpus" : "";
    const query = params.toString();
    router.push(query ? `${baseUrl}?${query}` : baseUrl || "/", { scroll: false });
  }, [currentView, router, searchParams]);

  const isFavoritesActive = searchParams.get("favorites") === "true";
  const isLLMsActive = pathname?.startsWith("/models") ?? false;
  const isGpuPage = pathname === "/" || pathname?.startsWith("/gpus");
  const isCpusPage = pathname?.startsWith("/cpus") ?? false;

  return (
    <>
      {searchFilter && searchFilter.type === "input" ? (
        <div className="mb-4">
          <DataTableFilterInput {...searchFilter} />
        </div>
      ) : null}

      <Accordion type="multiple" defaultValue={defaultAccordionValues}>
        <AccordionItem value="navigation" className="border-none">
          <AccordionTrigger className="w-full py-0 hover:no-underline data-[state=closed]:text-muted-foreground data-[state=open]:text-foreground focus-within:data-[state=closed]:text-foreground hover:data-[state=closed]:text-foreground [&>svg]:text-foreground/70">
            <div className="flex w-full items-center justify-between gap-2 truncate py-2 pr-2">
              <div className="flex items-center gap-2 truncate">
                <p className="text-sm font-medium text-foreground/70">Navigation</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="p-1">
              <div className="space-y-1">
                <SidebarLink href="/models" label="LLMs" active={isLLMsActive} />
                {currentView === "gpus" ? (
                  <SidebarLink
                    label="GPUs"
                    onClick={handleCurrentViewClick}
                    active={isGpuPage}
                  />
                ) : (
                  <SidebarLink href="/" label="GPUs" active={isGpuPage} />
                )}
                {currentView === "cpus" ? (
                  <SidebarLink
                    label="Tools"
                    onClick={handleCurrentViewClick}
                    active={isCpusPage}
                  />
                ) : (
                  <SidebarLink href="/cpus" label="Tools" active={isCpusPage} />
                )}
                {session ? (
                  <SidebarLink
                    label="Favorites"
                    onClick={handleFavoritesClick}
                    active={isFavoritesActive}
                  />
                ) : null}
                {!session ? (
                  <SidebarLink label="Sign in" onClick={handleSignIn} />
                ) : null}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {otherFilters?.map((field) => {
          const value = field.value as string;
          return (
            <AccordionItem key={value} value={value} className="border-none">
              <AccordionTrigger className="w-full py-0 hover:no-underline data-[state=closed]:text-muted-foreground data-[state=open]:text-foreground focus-within:data-[state=closed]:text-foreground hover:data-[state=closed]:text-foreground [&>svg]:text-foreground/70">
                <div className="flex w-full items-center justify-between gap-2 truncate py-2 pr-2">
                  <div className="flex items-center gap-2 truncate">
                    <p className="text-sm font-medium text-foreground/70">{field.label}</p>
                  </div>
                  <DataTableFilterResetButton {...field} />
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="p-1">
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
