import type { CpuColumnSchema } from "@/components/cpu-table/cpu-schema";

/**
 * Generates a stable identity key for a CPU configuration
 *
 * This function creates a deterministic key that uniquely identifies a CPU configuration
 * across different pricing scrapes and data snapshots. The key is based on immutable
 * characteristics of the CPU offering, not volatile data like pricing or timestamps.
 *
 * **Key Components:**
 * - Provider (e.g., "coreweave", "nebius")
 * - CPU Model (cpu_model | item | sku - provider-specific field names)
 * - vCPUs (e.g., "16", "8-40")
 * - RAM in GB (e.g., "200gb", "32-160gb")
 * - Type (e.g., "virtual machine", "bare metal")
 *
 * **Why This Matters:**
 * CPU configurations remain the same across scrapes, but UUIDs change.
 * This stable key allows favorites to persist across data refreshes.
 *
 * @param row - CPU configuration data (partial CpuColumnSchema)
 * @returns Stable key string (e.g., "coreweave:amd epyc genoa:16:200gb:virtual machine")
 *
 * @example
 * ```typescript
 * const key = stableCpuKey({
 *   provider: "coreweave",
 *   cpu_model: "AMD EPYC Genoa",
 *   vcpus: 16,
 *   system_ram_gb: 200,
 *   type: "Virtual Machine"
 * });
 * // Returns: "coreweave:amd epyc genoa:16:200gb:virtual machine"
 * ```
 */
export function stableCpuKey(
  row: Partial<Pick<CpuColumnSchema, "provider" | "cpu_model" | "item" | "sku" | "vcpus" | "system_ram_gb" | "type">>
): string {
  const provider = row.provider?.toLowerCase().trim();
  const model = (row.cpu_model || row.item || row.sku || "").toLowerCase().trim();
  const vcpus = typeof row.vcpus === "number" ? row.vcpus.toString() : "";
  const ram = typeof row.system_ram_gb === "number" ? `${row.system_ram_gb}gb` : "";
  const type = (row.type || "").toLowerCase().trim();

  return [provider, model, vcpus, ram, type].filter(Boolean).join(":");
}
