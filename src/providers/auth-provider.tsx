"use client";

import type { ReactNode } from "react";
import { AuthClientProvider } from "./auth-client-provider";

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Client-side auth provider
 *
 * Better Auth recommends using the React client to hydrate sessions
 * inside App Router components so pages remain cacheable/ISR-friendly.
 * See: https://www.better-auth.com/docs/integrations/next#react
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return <AuthClientProvider initialSession={null}>{children}</AuthClientProvider>;
}
