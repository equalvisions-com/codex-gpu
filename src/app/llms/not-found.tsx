export default function NotFound() {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 text-center">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Not Found
        </p>
        <h1 className="text-2xl font-semibold">Unable to locate that models view.</h1>
        <p className="text-muted-foreground">
          Double-check the URL or head back to the LLM comparison table.
        </p>
      </div>
      <a
        href="/llms"
        className="inline-flex items-center rounded-md border border-border/60 bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
      >
        Return to LLM Explorer
      </a>
    </div>
  );
}
