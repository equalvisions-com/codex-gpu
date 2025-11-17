import { registerOTel } from "@vercel/otel";

export function register() {
  // Ensure OpenTelemetry hooks into the Next.js runtime so trace ids are
  // available in route handlers and logs.
  registerOTel("deploybase-data-table");
}

