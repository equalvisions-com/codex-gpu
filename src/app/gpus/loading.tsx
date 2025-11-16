export default function Loading() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center">
      <span className="inline-flex items-center justify-center text-muted-foreground" aria-label="Loading">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/70 border-t-transparent" />
        <span className="sr-only">Loading GPUs</span>
      </span>
    </div>
  );
}
