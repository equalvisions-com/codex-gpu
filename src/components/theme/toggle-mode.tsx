"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { Button, ButtonProps } from "@/components/ui/button";
import { Laptop, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark" | "system";

interface ModeToggleProps extends ButtonProps {
  appearance?: "icon" | "menu";
}

export function ModeToggle({
  className,
  appearance = "icon",
  onClick,
  ...props
}: ModeToggleProps) {
  const { theme, setTheme } = useTheme();
  const currentTheme = (theme ?? "system") as ThemeMode;

  const modeLabel = React.useMemo(() => {
    switch (currentTheme) {
      case "light":
        return "Light";
      case "dark":
        return "Dark";
      case "system":
      default:
        return "System";
    }
  }, [currentTheme]);

  const Icon = React.useMemo(() => {
    switch (currentTheme) {
      case "light":
        return Sun;
      case "dark":
        return Moon;
      case "system":
      default:
        return Laptop;
    }
  }, [currentTheme]);

  const handleToggle = React.useCallback(() => {
    const order: ThemeMode[] = ["light", "dark", "system"];
    const index = order.indexOf(currentTheme);
    const nextTheme = order[(index + 1) % order.length];
    setTheme(nextTheme);
  }, [currentTheme, setTheme]);

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      handleToggle();
      onClick?.(event);
    },
    [handleToggle, onClick],
  );

  const ariaLabel = React.useMemo(() => `Switch theme (currently ${modeLabel})`, [modeLabel]);

  if (appearance === "menu") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "relative flex h-auto w-full items-center justify-start gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted focus:bg-muted focus:text-accent-foreground",
          "text-foreground",
          className,
        )}
        onClick={handleClick}
        title={`Theme: ${modeLabel}`}
        aria-label={`Switch theme (currently ${modeLabel})`}
        {...props}
      >
        <Icon className="h-4 w-4 transition-colors" />
        <span className="flex-1 text-left">Theme</span>
        <span className="sr-only">(current: {modeLabel})</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("w-9 px-0", className)}
      onClick={handleClick}
      title={`Theme: ${modeLabel}`}
      aria-label={ariaLabel}
      {...props}
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">Toggle theme (current: {modeLabel})</span>
    </Button>
  );
}
