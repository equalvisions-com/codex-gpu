"use client";

import { useEffect } from "react";

type HotkeyConfig = {
  combo: string; // e.g., "mod+/", "cmd+k", "ctrl+e"
  handler: () => void;
  allowWhenFocusedIds?: string[]; // optional allowlist for focused inputs
};

type ParsedCombo = {
  key: string | null;
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  mod: boolean;
};

function parseCombo(combo: string): ParsedCombo {
  const parts = combo.toLowerCase().split("+").map((part) => part.trim());
  const key = parts.pop() ?? null;
  return {
    key,
    meta: parts.some((part) => part === "meta" || part === "cmd" || part === "command"),
    ctrl: parts.some((part) => part === "ctrl" || part === "control"),
    shift: parts.includes("shift"),
    alt: parts.some((part) => part === "alt" || part === "option"),
    mod: parts.includes("mod"),
  };
}

function isTypingInInput(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  const editable = target.getAttribute("contenteditable");
  return (
    tag === "input" ||
    tag === "textarea" ||
    editable === "" ||
    editable === "true"
  );
}

export function useGlobalHotkeys(hotkeys: HotkeyConfig[]) {
  useEffect(() => {
    if (!hotkeys || hotkeys.length === 0) return;

    const parsed = hotkeys.map((hk) => ({
      ...hk,
      parsed: parseCombo(hk.combo),
      allowSet: new Set(hk.allowWhenFocusedIds ?? []),
    }));

    const handleKeydown = (event: KeyboardEvent) => {
      for (const hk of parsed) {
        const { key, meta, ctrl, shift, alt, mod } = hk.parsed;
        if (!key || event.key.toLowerCase() !== key) continue;
        if (meta && !event.metaKey) continue;
        if (!meta && !mod && event.metaKey) continue;
        if (ctrl && !event.ctrlKey) continue;
        if (!ctrl && !mod && event.ctrlKey) continue;
        if (shift && !event.shiftKey) continue;
        if (alt && !event.altKey) continue;
        if (!alt && event.altKey) continue;
        if (mod && !(event.metaKey || event.ctrlKey)) continue;

        const target = event.target as HTMLElement | null;
        if (isTypingInInput(target)) {
          const targetId = target?.id ?? "";
          if (!hk.allowSet.has(targetId)) {
            continue;
          }
        }

        event.preventDefault();
        hk.handler();
        break;
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [hotkeys]);
}
