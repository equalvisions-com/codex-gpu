"use client";

import * as React from "react";
import { authClient } from "@/lib/auth-client";
import type { Session } from "@/lib/auth-client";

type AuthContextValue = {
  session: Session | null;
  isPending: boolean;
  refetch: ReturnType<typeof authClient.useSession>["refetch"];
  signOut: typeof authClient.signOut;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

interface AuthClientProviderProps {
  initialSession: Session | null;
  children: React.ReactNode;
}

export function AuthClientProvider({ initialSession, children }: AuthClientProviderProps) {
  const { data, isPending, refetch } = authClient.useSession();
  const session = React.useMemo<Session | null>(() => {
    if (isPending) {
      return initialSession;
    }
    return (data ?? null) as Session | null;
  }, [data, initialSession, isPending]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session,
      isPending,
      refetch,
      signOut: authClient.signOut,
    }),
    [isPending, refetch, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthClientProvider");
  }
  return context;
}
