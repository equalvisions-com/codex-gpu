import { registerOTel } from "@vercel/otel";

export function register() {
  // Validate required env vars at startup — fails fast with a clear message
  // rather than cryptic runtime errors deep in the call stack.
  import("@/lib/env");

  // Ensure OpenTelemetry hooks into the Next.js runtime so trace ids are
  // available in route handlers and logs.
  registerOTel("deploybase-data-table");
}

