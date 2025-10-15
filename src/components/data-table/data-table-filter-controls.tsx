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
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-client-provider";
import { useAuthDialog } from "@/providers/auth-dialog-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useHotKey } from "@/hooks/use-hot-key";
import SpotlightSearchDialog from "../infinite-table/_components/spotlight-search-dialog";

// FIXME: use @container (especially for the slider element) to restructure elements

// TODO: only pass the columns to generate the filters!
// https://tanstack.com/table/v8/docs/framework/react/examples/filters

interface DataTableFilterControlsProps {
  currentView?: 'gpus' | 'cpus';
}

function SidebarLink({ href, label, onClick, disabled }: {
  href?: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
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
        )}
      >
        <span className="truncate">{label}</span>
      </button>
    );
  }

  if (!href) {
    return null;
  }

  return (
    <Link
      href={href}
      className={cn(baseClasses)}
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function DataTableFilterControls({ currentView = 'gpus' }: DataTableFilterControlsProps = {}) {
  const { filterFields } = useDataTable();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const { showSignIn } = useAuthDialog();
  const [isSpotlightOpen, setIsSpotlightOpen] = React.useState(false);

  // Add global keyboard shortcut for search (Cmd+K / Ctrl+K)
  useHotKey(() => setIsSpotlightOpen(true), "k");

  const handleSignIn = React.useCallback(() => {
    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/";
    showSignIn({ callbackUrl });
  }, [showSignIn]);

  const handleFavoritesClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("favorites", "true");
    const baseUrl = currentView === 'cpus' ? '/cpus' : '';
    router.push(`${baseUrl}?${params.toString()}`, { scroll: false });
  };

  const handleCurrentViewClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("favorites"); // Remove favorites filter when going to main view
    const baseUrl = currentView === 'cpus' ? '/cpus' : '';
    router.push(params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl || "/", { scroll: false });
  };

  return (
    <>
      <Accordion
        type="multiple"
        defaultValue={["navigation", ...(filterFields
          ?.filter(({ defaultOpen }) => defaultOpen)
          ?.map(({ value }) => value as string) || [])]}
      >
        {/* Navigation Section */}
        <AccordionItem value="navigation" className="border-none">
          <AccordionTrigger className="w-full py-0 hover:no-underline data-[state=closed]:text-muted-foreground data-[state=open]:text-foreground focus-within:data-[state=closed]:text-foreground hover:data-[state=closed]:text-foreground [&>svg]:text-foreground/70">
            <div className="flex w-full items-center justify-between gap-2 truncate py-2 pr-2">
              <div className="flex items-center gap-2 truncate">
                <p className="text-sm font-medium text-foreground/70">Menu</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="p-1">
              <div className="space-y-1">
                <SidebarLink href="/models" label="LLMs" />
                {currentView === 'gpus' ? (
                  <SidebarLink label="GPUs" onClick={handleCurrentViewClick} />
                ) : (
                  <SidebarLink href="/" label="GPUs" />
                )}
                {currentView === 'cpus' ? (
                  <SidebarLink label="Tools" onClick={handleCurrentViewClick} />
                ) : (
                  <SidebarLink href="/cpus" label="Tools" />
                )}
                <SidebarLink
                  label="Search"
                  onClick={() => setIsSpotlightOpen(true)}
                />
                {session ? (
                  <SidebarLink label="Favorites" onClick={handleFavoritesClick} />
                ) : null}
                {!session ? (
                  <SidebarLink label="Sign in" onClick={handleSignIn} />
                ) : null}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Filter Sections */}
        {filterFields?.map((field) => {
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
                {/* REMINDER: avoid the focus state to be cut due to overflow-hidden */}
                {/* REMINDER: need to move within here because of accordion height animation */}
                <div className="p-1">
                  {(() => {
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
      {isSpotlightOpen && (
        <SpotlightSearchDialog open={isSpotlightOpen} onOpenChange={setIsSpotlightOpen} />
      )}
    </>
  );
}
