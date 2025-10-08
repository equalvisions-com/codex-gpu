"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthView } from "@/components/auth/auth-dialog";
import { AuthDialog } from "@/components/auth/auth-dialog";

interface OpenDialogOptions {
  view?: AuthView;
  email?: string;
  callbackUrl?: string;
  errorCallbackUrl?: string;
}

interface AuthDialogContextValue {
  isOpen: boolean;
  view: AuthView;
  openDialog: (options?: OpenDialogOptions) => void;
  showSignIn: (options?: Omit<OpenDialogOptions, "view">) => void;
  showSignUp: (options?: Omit<OpenDialogOptions, "view">) => void;
  closeDialog: () => void;
  setView: (view: AuthView) => void;
}

interface AuthDialogProviderProps {
  children: React.ReactNode;
}

type DialogState = {
  open: boolean;
  view: AuthView;
  callbackUrl: string;
  errorCallbackUrl?: string;
  defaultEmail?: string;
};

const AuthDialogContext = React.createContext<AuthDialogContextValue | null>(null);

export function AuthDialogProvider({ children }: AuthDialogProviderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [, startTransition] = React.useTransition();
  const [state, setState] = React.useState<DialogState>({
    open: false,
    view: "signIn",
    callbackUrl: "/",
    errorCallbackUrl: undefined,
    defaultEmail: undefined,
  });

  const clearAuthQuery = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const params = url.searchParams;
    let touched = false;
    for (const key of ["auth", "email", "callbackUrl", "errorCallbackUrl"]) {
      if (params.has(key)) {
        params.delete(key);
        touched = true;
      }
    }
    if (!touched) {
      return;
    }
    const next = params.toString();
    router.replace(`${url.pathname}${next ? `?${next}` : ""}`, {
      scroll: false,
    });
  }, [router]);

  const openDialog = React.useCallback((options?: OpenDialogOptions) => {
    setState({
      open: true,
      view: options?.view ?? "signIn",
      callbackUrl: options?.callbackUrl ?? "/",
      errorCallbackUrl: options?.errorCallbackUrl,
      defaultEmail: options?.email,
    });
  }, []);

  const closeDialogInternal = React.useCallback(
    (options?: { preserveSearch?: boolean }) => {
      setState((prev) => ({
        ...prev,
        open: false,
        defaultEmail: undefined,
      }));
      if (!options?.preserveSearch) {
        clearAuthQuery();
      }
    },
    [clearAuthQuery]
  );

  const closeDialog = React.useCallback(() => {
    closeDialogInternal();
  }, [closeDialogInternal]);

  const resolveDestination = React.useCallback((destination: string) => {
    if (typeof window === "undefined") {
      return destination || "/";
    }
    const baseOrigin = window.location.origin;
    const fallback = "/";
    try {
      const url = new URL(destination || "/", baseOrigin);
      if (url.origin !== baseOrigin) {
        return fallback;
      }
      for (const key of ["auth", "email", "callbackUrl", "errorCallbackUrl"]) {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
        }
      }
      const nextSearch = url.searchParams.toString();
      const next = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
      return next || fallback;
    } catch (error) {
      if (destination?.startsWith("/")) {
        return destination;
      }
      return fallback;
    }
  }, []);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        closeDialogInternal();
        return;
      }
      setState((prev) => ({
        ...prev,
        open: true,
      }));
    },
    [closeDialogInternal]
  );

  const handleComplete = React.useCallback(
    (destination: string) => {
      closeDialogInternal({ preserveSearch: true });
      const target = resolveDestination(destination);
      startTransition(() => {
        router.replace(target, { scroll: false });
        router.refresh();
      });
    },
    [closeDialogInternal, resolveDestination, router, startTransition]
  );

  const setView = React.useCallback((nextView: AuthView) => {
    setState((prev) => ({
      ...prev,
      view: nextView,
    }));
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(searchKey);
    const authParam = params.get("auth");
    if (!authParam) {
      return;
    }
    const normalized = authParam.toLowerCase();
    const targetView: AuthView =
      normalized === "signup" ? "signUp" : "signIn";

    if (
      state.open &&
      state.view === targetView &&
      state.callbackUrl === (params.get("callbackUrl") ?? "/") &&
      state.defaultEmail === (params.get("email") ?? undefined) &&
      state.errorCallbackUrl === (params.get("errorCallbackUrl") ?? undefined)
    ) {
      return;
    }

    openDialog({
      view: targetView,
      email: params.get("email") ?? undefined,
      callbackUrl: params.get("callbackUrl") ?? undefined,
      errorCallbackUrl: params.get("errorCallbackUrl") ?? undefined,
    });
  }, [
    openDialog,
    searchKey,
    state.callbackUrl,
    state.errorCallbackUrl,
    state.defaultEmail,
    state.open,
    state.view,
  ]);

  const contextValue = React.useMemo<AuthDialogContextValue>(
    () => ({
      isOpen: state.open,
      view: state.view,
      openDialog,
      closeDialog,
      setView,
      showSignIn: (options) => openDialog({ ...options, view: "signIn" }),
      showSignUp: (options) => openDialog({ ...options, view: "signUp" }),
    }),
    [closeDialog, openDialog, setView, state.open, state.view]
  );

  return (
    <AuthDialogContext.Provider value={contextValue}>
      {children}
      <AuthDialog
        open={state.open}
        initialView={state.view}
        onOpenChange={handleOpenChange}
        onViewChange={setView}
        onComplete={handleComplete}
        callbackUrl={state.callbackUrl}
        errorCallbackUrl={state.errorCallbackUrl}
        defaultEmail={state.defaultEmail}
      />
    </AuthDialogContext.Provider>
  );
}

export function useAuthDialog() {
  const context = React.useContext(AuthDialogContext);
  if (!context) {
    throw new Error("useAuthDialog must be used within an AuthDialogProvider");
  }
  return context;
}
