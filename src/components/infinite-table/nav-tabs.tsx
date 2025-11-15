"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type DesktopNavItem =
  | {
      type: "link";
      href: string;
      label: string;
      isActive: boolean;
    }
  | {
      type: "action";
      label: string;
      icon: LucideIcon;
      isActive: boolean;
      onSelect: () => void;
    };

interface DesktopNavTabsProps {
  items: DesktopNavItem[];
  className?: string;
}

export function DesktopNavTabs({ items, className }: DesktopNavTabsProps) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg p-1", className)}>
      {items.map((item) =>
        item.type === "link" ? (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.isActive ? "page" : undefined}
            className={cn(
              "flex h-8 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium transition-all border border-transparent",
              item.isActive
                ? "bg-background text-foreground border-border"
                : "text-foreground/80",
              item.isActive
                ? "hover:text-foreground"
                : "hover:bg-background hover:text-foreground hover:border-border",
            )}
          >
            <span className="truncate">{item.label}</span>
          </Link>
        ) : (
          <button
            key={item.label}
            type="button"
            onClick={item.onSelect}
            aria-pressed={item.isActive}
            className={cn(
              "flex h-8 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium transition-all border border-transparent",
              item.isActive
                ? "bg-background text-foreground border-border"
                : "text-foreground/80",
              item.isActive
                ? "hover:text-foreground"
                : "hover:bg-background hover:text-foreground hover:border-border",
            )}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{item.label}</span>
          </button>
        ),
      )}
    </div>
  );
}
