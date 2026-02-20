"use client";

import { Button } from "@/components/ui/button";
import { DataTableFilterControls } from "@/features/data-explorer/data-table/data-table-filter-controls";
import { DataTableFilterInput } from "@/features/data-explorer/data-table/data-table-filter-input";
import type { DataTableInputFilterField } from "@/features/data-explorer/data-table/types";
import { cn } from "@/lib/utils";
import * as React from "react";
import { Bookmark, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserMenu, type AccountUser } from "./account-components";
import type { NavItem } from "./data-table-infinite";

export interface DataTableSidebarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchFilterField: DataTableInputFilterField<any> | undefined;
  isDesktopSearchOpen: boolean;
  toggleDesktopSearch: () => void;
  currentNavValue: string;
  currentNavItem: NavItem | undefined;
  resolvedNavItems: NavItem[];
  isBookmarksMode: boolean;
  handleNavChange: (value: string) => void;
  routerPrefetch: (url: string) => void;
  routerPush: (url: string) => void;
  accountUser: AccountUser | null;
  accountOnSignOut: () => void;
  accountIsSigningOut: boolean;
  accountOnSignIn?: () => void;
  accountOnSignUp?: () => void;
  accountIsLoading: boolean;
}

export function DataTableSidebar({
  searchFilterField,
  isDesktopSearchOpen,
  toggleDesktopSearch,
  currentNavValue,
  currentNavItem,
  resolvedNavItems,
  isBookmarksMode,
  handleNavChange,
  routerPrefetch,
  routerPush,
  accountUser,
  accountOnSignOut,
  accountIsSigningOut,
  accountOnSignIn,
  accountOnSignUp,
  accountIsLoading,
}: DataTableSidebarProps) {
  return (
    <div
      className={cn(
        "hidden sm:flex h-[calc(100dvh-var(--total-padding-mobile))] sm:h-[100dvh] flex-col sticky top-0 self-start min-w-72 max-w-72 rounded-lg overflow-hidden"
      )}
    >
      <div className="flex h-full w-full flex-col">
        <div className="mx-auto w-full max-w-full p-4 border-b border-border mb-4 space-y-4">
          <div className="flex items-center gap-2">
            {searchFilterField && isDesktopSearchOpen ? (
              <div className="w-full">
                <DataTableFilterInput
                  autoFocus={isDesktopSearchOpen}
                  {...(searchFilterField as DataTableInputFilterField<Record<string, unknown>>)}
                />
              </div>
            ) : (
              <Select
                value={currentNavValue}
                onValueChange={handleNavChange}
                onOpenChange={(open) => {
                  // Prefetch all nav routes when Select opens (skip current page)
                  if (open) {
                    resolvedNavItems.forEach((item) => {
                      if (item.value !== currentNavValue) {
                        routerPrefetch(item.value);
                      }
                    });
                  }
                }}
                hotkeys={[
                  { combo: "cmd+k", value: "/llms" },
                  { combo: "cmd+g", value: "/gpus" },
                  { combo: "cmd+e", value: "/tools" },
                ]}
              >
                <SelectTrigger className="h-9 w-full justify-between rounded-lg shadow-sm" aria-label="Page navigation">
                  <SelectValue aria-label={currentNavItem?.label}>
                    {currentNavItem && (
                      <span className="flex min-w-0 items-center gap-2">
                        {isBookmarksMode ? (
                          <Bookmark className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <currentNavItem.icon className="h-4 w-4" aria-hidden="true" />
                        )}
                        {currentNavItem.label}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {resolvedNavItems.map((item) => (
                    <SelectItem
                      key={item.value}
                      value={item.value}
                      className="gap-2 cursor-pointer"
                      shortcut={item.shortcut}
                      onPointerDown={(e) => {
                        // Only navigate for same-page clicks in bookmarks mode
                        // onPointerDown fires before Radix prevents re-selection of checked items
                        if (isBookmarksMode && item.value === currentNavValue) {
                          e.preventDefault();
                          routerPush(item.value);
                        }
                      }}
                    >
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {searchFilterField ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={toggleDesktopSearch}
                aria-pressed={isDesktopSearchOpen}
                className="shrink-0 rounded-lg bg-gradient-to-b from-muted/70 via-muted/40 to-background shadow-sm"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Search</span>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="mx-auto w-full max-w-full px-4 pb-4">
            <DataTableFilterControls showSearch={false} />
          </div>
        </div>
        <div className="flex-shrink-0 p-4 border-t border-border">
          <UserMenu
            user={accountUser}
            onSignOut={accountOnSignOut}
            isSigningOut={accountIsSigningOut}
            isAuthenticated={Boolean(accountUser)}
            forceUnauthSignInButton
            onSignIn={accountOnSignIn}
            onSignUp={accountOnSignUp}
            isLoading={accountIsLoading}
          />
        </div>
      </div>
    </div>
  );
}
