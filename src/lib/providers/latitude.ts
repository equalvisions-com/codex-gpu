import crypto from 'crypto';
import type { LatitudePriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';

// Two endpoints: bare metal GPU plans and virtual machine plans
const BARE_METAL_API_URL = 'https://api.latitude.sh/plans?filter[gpu]=true';
const VM_API_URL = 'https://api.latitude.sh/plans/virtual_machines';
const PRICING_URL = 'https://www.latitude.sh/pricing';

// API response types based on actual docs
interface LatitudeRegion {
    name: string;
    deploys_instantly?: string[];
    locations?: {
        available: string[];
        in_stock: string[];
    };
    stock_level?: string;
    pricing: {
        USD?: { hour?: number; month?: number; year?: number };
        BRL?: { hour?: number; month?: number; year?: number };
    };
}

interface LatitudePlan {
    id: string;
    type: string;
    attributes: {
        name: string;
        slug: string;
        features?: string[];
        specs: {
            cpu?: { type?: string; clock?: number; cores?: number; count?: number };
            vcpus?: number;
            memory?: { total?: number };
            gpu?: {
                type?: string;
                count?: number;
                vram_per_gpu?: number;
                interconnect?: string;
            };
            drives?: Array<{ size?: string; type?: string; count?: number }>;
            disk?: { size?: number | { amount?: number; unit?: string }; type?: string };
            nics?: Array<{ type?: string; count?: number }>;
        };
        regions?: LatitudeRegion[];
        // VM plans use 'available_in' instead of 'regions'
        available_in?: Array<{
            region?: { city?: string; country?: string; slug?: string };
            pricing: {
                USD?: { hour?: number; month?: number };
            };
        }>;
    };
}

interface LatitudePlansResponse {
    data: LatitudePlan[];
    meta?: Record<string, unknown>;
}

class LatitudeScraper implements ProviderScraper {
    name = 'latitude';
    url = PRICING_URL;
    scrapeIntervalMinutes = 1440;
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        const apiKey = process.env.LATITUDE_SH;

        if (!apiKey) {
            console.warn('[LatitudeScraper] LATITUDE_SH environment variable not set, skipping');
            return {
                provider: "latitude",
                rows: [],
                observedAt: new Date().toISOString(),
                sourceHash: '',
            };
        }

        try {
            // Fetch both bare metal and VM plans in parallel
            const [bareMetalResponse, vmResponse] = await Promise.all([
                fetch(BARE_METAL_API_URL, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Accept': 'application/json',
                    },
                }),
                fetch(VM_API_URL, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Accept': 'application/json',
                    },
                }),
            ]);

            const bareMetalData: LatitudePlansResponse = bareMetalResponse.ok
                ? await bareMetalResponse.json()
                : { data: [] };
            const vmData: LatitudePlansResponse = vmResponse.ok
                ? await vmResponse.json()
                : { data: [] };

            // Combine data for hash
            const combinedData = { bareMetalData, vmData };
            const sourceHash = crypto.createHash('sha256').update(JSON.stringify(combinedData)).digest('hex');

            console.log(`[LatitudeScraper] Bare Metal API: ${bareMetalData.data?.length || 0} GPU plans, VM API: ${vmData.data?.length || 0} VM plans`);

            // Parse plans from both sources
            const bareMetalRows = this.parsePlans(bareMetalData.data || [], 'Bare Metal');
            const vmRows = this.parsePlans(vmData.data || [], 'Virtual Machine');

            const rows = [...bareMetalRows, ...vmRows];
            console.log(`[LatitudeScraper] Parsed ${rows.length} GPU pricing rows (${bareMetalRows.length} bare metal, ${vmRows.length} VMs)`);

            return {
                provider: "latitude",
                rows,
                observedAt: new Date().toISOString(),
                sourceHash,
            };
        } catch (error) {
            throw new Error(`Latitude scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Map of VM plan name patterns to GPU info
     * Format: vm.{gpu_type}.{size}
     */
    private static readonly VM_GPU_MAP: Record<string, { model: string; vram: number }> = {
        'l40s': { model: 'NVIDIA L40S', vram: 48 },
        'h100': { model: 'NVIDIA H100', vram: 80 },
        'rtx6kpro': { model: 'NVIDIA RTX PRO 6000', vram: 48 },
        'a100': { model: 'NVIDIA A100', vram: 80 },
    };

    /**
     * Normalize GPU model name by stripping VRAM
     * e.g., "NVIDIA H100 80GB NVLink" -> "NVIDIA H100 NVLink"
     */
    private normalizeGpuModel(model: string): string {
        return model
            // Remove VRAM specs like "80GB", "48 GB", etc.
            .replace(/\s*\d+\s*GB\b/gi, '')
            // Clean up extra spaces
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Parse plans from API response
     */
    private parsePlans(plans: LatitudePlan[], defaultType: 'Virtual Machine' | 'Bare Metal'): LatitudePriceRow[] {
        const rows: LatitudePriceRow[] = [];
        const observedAt = new Date().toISOString();

        for (const plan of plans) {
            const { attributes } = plan;
            const { name, slug, specs } = attributes;

            let gpuModel: string;
            let gpuCount: number;
            let vramGb: number | undefined;

            // Check if explicit GPU specs exist (bare metal)
            if (specs?.gpu?.type && specs?.gpu?.count) {
                // Strip VRAM and extra suffixes from model name (e.g., "NVIDIA H100 80GB NVLink" -> "NVIDIA H100")
                let rawModel = specs.gpu.type;
                if (!rawModel.includes('NVIDIA') && !rawModel.includes('AMD')) {
                    rawModel = `NVIDIA ${rawModel}`;
                }
                gpuModel = this.normalizeGpuModel(rawModel);
                gpuCount = specs.gpu.count;
                vramGb = specs.gpu.vram_per_gpu;
            } else if (defaultType === 'Virtual Machine' && name.startsWith('vm.')) {
                // Parse GPU from VM plan name: vm.{gpu_type}.{size}
                const parts = name.split('.');
                if (parts.length >= 2) {
                    const gpuKey = parts[1].toLowerCase();
                    const gpuInfo = LatitudeScraper.VM_GPU_MAP[gpuKey];
                    if (gpuInfo) {
                        gpuModel = gpuInfo.model;
                        gpuCount = 1; // VMs typically have 1 GPU
                        vramGb = gpuInfo.vram;
                    } else {
                        console.log(`  [LatitudeScraper] Unknown GPU type in VM name: ${name}`);
                        continue;
                    }
                } else {
                    continue;
                }
            } else {
                // No GPU info available
                continue;
            }

            // Get specs - handle both bare metal (cpu.cores) and VM (vcpus/memory as number) formats
            const vcpus = specs?.vcpus || specs?.cpu?.cores || specs?.cpu?.count;
            const systemRamGb = typeof specs?.memory === 'number' ? specs.memory : specs?.memory?.total;

            // Get storage - handle both formats
            let storage: string | undefined;
            if (specs?.drives && specs.drives.length > 0) {
                const drive = specs.drives[0];
                storage = `${drive.count || 1}x ${drive.size} ${drive.type || 'SSD'}`;
            } else if (specs?.disk) {
                const diskSize = typeof specs.disk.size === 'object'
                    ? `${specs.disk.size.amount} ${specs.disk.size.unit?.toUpperCase() || 'GB'}`
                    : `${specs.disk.size}GB`;
                storage = `${diskSize} ${specs.disk.type || 'SSD'}`;
            }

            // Find the lowest hourly price across all regions
            const pricingLocations = attributes.regions || attributes.available_in || [];

            let lowestHourlyPrice: number | undefined;
            let lowestMonthlyPrice: number | undefined;

            for (const location of pricingLocations) {
                const hourly = location.pricing?.USD?.hour;
                const monthly = location.pricing?.USD?.month;

                if (typeof hourly === 'number' && Number.isFinite(hourly)) {
                    if (lowestHourlyPrice === undefined || hourly < lowestHourlyPrice) {
                        lowestHourlyPrice = hourly;
                    }
                }
                if (typeof monthly === 'number' && Number.isFinite(monthly)) {
                    if (lowestMonthlyPrice === undefined || monthly < lowestMonthlyPrice) {
                        lowestMonthlyPrice = monthly;
                    }
                }
            }

            // Skip if no hourly pricing available
            if (lowestHourlyPrice === undefined) {
                console.log(`  [LatitudeScraper] Skipping ${name}: no hourly pricing found`);
                continue;
            }

            rows.push({
                provider: 'latitude',
                source_url: PRICING_URL,
                observed_at: observedAt,
                instance_id: slug || name,
                gpu_model: gpuModel,
                gpu_count: gpuCount,
                vram_gb: vramGb,
                vcpus: vcpus,
                system_ram_gb: systemRamGb,
                storage: storage,
                price_unit: 'instance_hour',
                price_hour_usd: lowestHourlyPrice,
                price_month_usd: lowestMonthlyPrice,
                raw_cost: `$${lowestHourlyPrice.toFixed(2)}/hr`,
                class: 'GPU',
                type: defaultType,
            });
        }

        return rows;
    }
}

export const latitudeScraper = new LatitudeScraper();
