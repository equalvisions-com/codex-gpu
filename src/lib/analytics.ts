import { usePlausible } from "next-plausible";

/**
 * Central registry of all Plausible custom events.
 * Grep for `// [Analytics]` to find every call site.
 */
export type AnalyticsEvents = {
  Signup: { method: "email" | "google" | "github" | "huggingface" };
  Login: { method: "email" | "google" | "github" | "huggingface" };
  "Forgot Password": never;
  "Account Deleted": never;
  "Affiliate Click": { provider: string; table: "gpu" | "llm" | "tool" };
  Search: { query: string; table: "gpu" | "llm" | "tool" };
  "Newsletter Subscribe": never;
  "Newsletter Unsubscribe": never;
  "404": never;
  "Row Detail": { table: "gpu" | "llm" | "tool"; name: string };
  "Form Submit": { form: "contact" | "submit-provider" };
};

export const useAnalytics = () => usePlausible<AnalyticsEvents>();
