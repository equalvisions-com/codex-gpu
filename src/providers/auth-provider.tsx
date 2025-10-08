import * as React from "react";
import { headers } from "next/headers";
import { getCookieCache } from "better-auth/cookies";
import type { Session } from "@/lib/auth-client";
import { AuthClientProvider } from "./auth-client-provider";
import { auth } from "@/lib/auth";

interface AuthProviderProps {
  children: React.ReactNode;
}

export async function AuthProvider({ children }: AuthProviderProps) {
  const hdrs = await headers();
  let session: Session | null = null;

  try {
    const secret = process.env.BETTER_AUTH_SECRET;
    if (secret) {
      const headerBag = new Headers(hdrs);
      session = (await getCookieCache(headerBag, { secret })) as Session | null;
    }
    if (!session) {
      session = (await auth.api.getSession({ headers: hdrs })) as Session | null;
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[AuthProvider] Failed to hydrate session", error);
    }
  }

  return <AuthClientProvider initialSession={session}>{children}</AuthClientProvider>;
}
