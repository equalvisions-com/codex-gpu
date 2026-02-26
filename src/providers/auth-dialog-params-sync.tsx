"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useAuthDialog } from "./auth-dialog-provider";
import type { AuthView } from "@/components/auth/auth-dialog";

/**
 * Reads the `?auth=signin|signup` search param and opens the auth dialog.
 *
 * Extracted from AuthDialogProvider so that useSearchParams() is isolated in
 * its own Suspense boundary — preventing it from bailing out the entire
 * {children} subtree during static generation.
 */
export function AuthDialogParamsSync() {
  const searchParams = useSearchParams();
  const { openDialog, isOpen, view } = useAuthDialog();
  const searchKey = searchParams.toString();

  React.useEffect(() => {
    const params = new URLSearchParams(searchKey);
    const authParam = params.get("auth");
    if (!authParam) {
      return;
    }
    const normalized = authParam.toLowerCase();
    const targetView: AuthView =
      normalized === "signup" ? "signUp" : "signIn";

    if (isOpen && view === targetView) {
      return;
    }

    openDialog({
      view: targetView,
      email: params.get("email") ?? undefined,
      callbackUrl: params.get("callbackUrl") ?? undefined,
      errorCallbackUrl: params.get("errorCallbackUrl") ?? undefined,
    });
  }, [searchKey, openDialog, isOpen, view]);

  return null;
}
