"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignOutPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const navigateToSignIn = () => {
      if (cancelled) return;
      startTransition(() => {
        router.replace("/", { scroll: false });
        router.refresh();
      });
    };

    authClient.signOut().then(navigateToSignIn).catch(navigateToSignIn);

    return () => {
      cancelled = true;
    };
  }, [router, startTransition]);

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-2 text-xl font-semibold">Signing you out…</h1>
      <p className="text-sm text-muted-foreground">One moment.</p>
    </main>
  );
}
