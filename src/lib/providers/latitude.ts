import crypto from 'crypto';
import type { LatitudePriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';
import { logger } from "@/lib/logger";

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
        slug?: string;
        features?: string[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        specs: Record<string, any>;  // Flexible for both VM and bare metal
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        regions?: any[];
        stock_level?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        available_in?: any[];
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
            logger.warn('[LatitudeScraper] LATITUDE_SH environment variable not set, skipping');
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

            logger.info(`[LatitudeScraper] Bare Metal API: ${bareMetalData.data?.length || 0} GPU plans, VM API: ${vmData.data?.length || 0} VM plans`);

            // Parse plans from both sources
            const bareMetalRows = this.parsePlans(bareMetalData.data || [], 'Bare Metal');
            const vmRows = this.parsePlans(vmData.data || [], 'Virtual Machine');

            const rows = [...bareMetalRows, ...vmRows];
            logger.info(`[LatitudeScraper] Parsed ${rows.length} GPU pricing rows (${bareMetalRows.length} bare metal, ${vmRows.length} VMs)`);

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
     * Normalize GPU model name by stripping VRAM
     * e.g., "NVIDIA H100 80GB NVLink" -> "NVIDIA H100 NVLink"
     */
    private normalizeGpuModel(model: string): string {
        return model
            // Remove VRAM specs like "80GB", "48 GB", etc.
            .replace(/\s*\d+\s*GB\b/gi, '')
            // Convert "Server Edition" to "SE"
            .replace(/\bServer Edition\b/gi, 'SE')
            // Strip NVLink from model name
            .replace(/\s+NVLink\b/gi, '')
            // Clean up extra spaces
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Parse VRAM from string like "48 Gb" or "80 GB"
     */
    private parseVramString(vramStr: string | number | undefined): number | undefined {
        if (typeof vramStr === 'number') return vramStr;
        if (typeof vramStr !== 'string') return undefined;
        const match = vramStr.match(/(\d+)/);
        return match ? parseInt(match[1]) : undefined;
    }

    /**
     * Parse plans from API response
     * 
     * Bare Metal API structure:
     *   specs.gpu.type = "NVIDIA H100 80GB NVLink"
     *   specs.gpu.count = 4
     *   specs.gpu.vram_per_gpu = 80 (number)
     *   specs.memory.total = 768 (system RAM)
     * 
     * VM API structure:
     *   specs.gpu = "NVIDIA L40S" (string)
     *   specs.vram_per_gpu = "48 Gb" (string)
     *   specs.memory = 128 (system RAM as number)
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
            let systemRamGb: number | undefined;
            let vcpus: number | undefined;

            if (defaultType === 'Virtual Machine') {
                // VM API: specs.gpu is a string, specs.vram_per_gpu is a string
                if (typeof specs?.gpu !== 'string' || !specs.gpu) {
                    continue; // Skip non-GPU VMs
                }

                // GPU model directly from API
                gpuModel = this.normalizeGpuModel(specs.gpu);
                gpuCount = 1; // VMs have 1 GPU

                // VRAM from string like "48 Gb"
                vramGb = this.parseVramString(specs.vram_per_gpu);

                // System RAM for VMs
                systemRamGb = typeof specs?.memory === 'number' ? specs.memory : undefined;
                vcpus = specs?.vcpus;

            } else {
                // Bare Metal API: specs.gpu is an object
                if (!specs?.gpu?.type || !specs?.gpu?.count) {
                    continue; // Skip non-GPU bare metal
                }

                let rawModel = specs.gpu.type;
                if (!rawModel.includes('NVIDIA') && !rawModel.includes('AMD')) {
                    rawModel = `NVIDIA ${rawModel}`;
                }
                gpuModel = this.normalizeGpuModel(rawModel);
                gpuCount = specs.gpu.count;
                // Total VRAM = per-GPU VRAM × GPU count
                const vramPerGpu = specs.gpu.vram_per_gpu;
                vramGb = vramPerGpu ? vramPerGpu * gpuCount : undefined;

                // System RAM for bare metal
                systemRamGb = specs?.memory?.total;
                vcpus = specs?.cpu?.cores || specs?.cpu?.count;
            }

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
                logger.info(`  [LatitudeScraper] Skipping ${name}: no hourly pricing found`);
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
