import { NextRequest } from "next/server";
import { pricingCache } from "@/lib/redis";
import { createHash } from "crypto";
import { unstable_cache } from "next/cache";
import type { ColumnSchema } from "@/components/infinite-table/schema";
import type { CpuColumnSchema } from "@/components/cpu-table/cpu-schema";

interface UnifiedSearchResult {
  uuid: string;
  type: "gpu" | "cpu";
  model: string;
  provider: string;
  price_hour_usd?: number;
  price_usd?: number;
  vcpus?: number | string;
  gpu_count?: number;
  vram_gb?: number;
  system_ram_gb?: number;
  class: string;
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q")?.trim() || "";
    const isPreload = url.searchParams.has("preload");

    // Allow empty queries for preloading, but require minimum length for actual searches
    if (!isPreload && (!query || query.length < 2)) {
      return Response.json({ data: [] });
    }

    // Get all pricing snapshots
    const getSnapshotsCached = unstable_cache(
      async () => {
        return await pricingCache.getAllPricingSnapshots();
      },
      ["pricing:snapshots"],
      { revalidate: 900, tags: ["pricing"] }
    );

    const pricingSnapshots = await getSnapshotsCached();

    // Process all data (both GPU and CPU)
    const allData: UnifiedSearchResult[] = pricingSnapshots.flatMap((snapshot: any) =>
      snapshot.rows.map((row: any) => {
        const observedAt = snapshot.last_updated;
        const hashInput = JSON.stringify({ provider: snapshot.provider, observed_at: observedAt, row });
        const uuid = createHash("sha256").update(hashInput).digest("hex");

        const isGpu = row.class === 'GPU';
        const isCpu = row.class === 'CPU';

        // Skip non-GPU/CPU rows
        if (!isGpu && !isCpu) return null;

        // Get model name - different fields for different providers/types
        let model = "";
        if (isGpu) {
          model = row.gpu_model || row.item || "";
        } else if (isCpu) {
          model = row.cpu_model || row.item || "";
        }

        return {
          uuid,
          type: isGpu ? "gpu" : "cpu",
          model,
          provider: snapshot.provider,
          price_hour_usd: row.price_hour_usd,
          price_usd: row.price_usd,
          vcpus: row.vcpus,
          gpu_count: row.gpu_count,
          vram_gb: row.vram_gb,
          system_ram_gb: row.system_ram_gb,
          class: row.class,
        } as UnifiedSearchResult;
      }).filter(Boolean)
    );

    // If this is a preload request, return the entire dataset without any limiting
    if (isPreload) {
      return Response.json(
        { data: allData },
        {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          },
        },
      );
    }

    let results: UnifiedSearchResult[];

    // For searching, filter by query comprehensively (case-insensitive)
    const searchLower = query.toLowerCase();
    const filteredData = allData.filter(item => {
      // Search across all relevant fields - same logic as client-side
      const searchableFields = [
        item.model,
        item.provider,
        item.type,
        item.class,
        // Include hardware specs as searchable text
        item.gpu_count ? `${item.gpu_count}x GPU` : null,
        item.vram_gb ? `${item.vram_gb}GB VRAM` : null,
        item.vcpus ? `${item.vcpus} vCPU${Number(item.vcpus) !== 1 ? 's' : ''}` : null,
        item.system_ram_gb ? `${item.system_ram_gb}GB RAM` : null,
        // Include price information
        item.price_hour_usd ? `$${item.price_hour_usd.toFixed(2)}/hr` : null,
        item.price_usd ? `$${item.price_usd.toFixed(2)}/hr` : null,
      ].filter(Boolean); // Remove null values

      // Check if any field contains the search query
      return searchableFields.some(field =>
        field?.toLowerCase().includes(searchLower)
      );
    });

    // Group by type and limit results per type to ensure balanced GPU/CPU representation
    const groupedResults = filteredData.reduce((acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = [];
      }
      if (acc[item.type].length < Math.ceil(limit / 2)) {
        acc[item.type].push(item);
      }
      return acc;
    }, {} as Record<string, UnifiedSearchResult[]>);

    // Flatten results with GPUs first, then CPUs
    results = [
      ...(groupedResults.gpu || []),
      ...(groupedResults.cpu || [])
    ];

    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.max(Number.parseInt(limitParam, 10) || 0, 1) : 50;

    return Response.json({
      data: results.slice(0, limit),
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });

  } catch (error) {
    console.error('Error in unified search API:', error);
    return Response.json(
      {
        error: 'Failed to search infrastructure catalog',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
