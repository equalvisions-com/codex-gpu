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
  const [localSession, setLocalSession] = React.useState<Session | null>(initialSession);

  // Prevent hydration mismatch: server always renders isPending=true (skeleton).
  // Without this guard the client can resolve isPending=false on the very first
  // render, producing a button where the server emitted a skeleton.
  const [hasMounted, setHasMounted] = React.useState(false);
  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  React.useEffect(() => {
    if (typeof data !== "undefined") {
      setLocalSession((data ?? null) as Session | null);
    }
  }, [data]);

  // During hydration (hasMounted=false) always report pending so the client
  // renders the same skeleton the server emitted. Once mounted, use the real value.
  const safePending = hasMounted ? isPending : true;

  const session = React.useMemo<Session | null>(() => {
    if (safePending) {
      return localSession;
    }
    return (data ?? null) as Session | null;
  }, [data, safePending, localSession]);

  const handleSignOut = React.useCallback<typeof authClient.signOut>(async (...args) => {
    const result = await authClient.signOut(...args);
    setLocalSession(null);
    return result;
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session,
      isPending: safePending,
      refetch,
      signOut: handleSignOut,
    }),
    [handleSignOut, safePending, refetch, session]
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
