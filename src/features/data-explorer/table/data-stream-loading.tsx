export function DataStreamLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[100dvh] w-full items-center justify-center"
    >
      <div className="sr-only">Loading data table...</div>
    </div>
  );
}

