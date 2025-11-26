'use client';

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center space-y-4 text-center">
      <div className="space-y-1">
        <p className="text-sm uppercase tracking-wide text-destructive">Something went wrong</p>
        <h1 className="text-2xl font-semibold">We couldn&apos;t load GPU pricing.</h1>
        <p className="text-muted-foreground">Please try again. If the issue persists, contact support.</p>
      </div>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
