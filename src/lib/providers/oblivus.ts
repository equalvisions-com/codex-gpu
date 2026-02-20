import crypto from 'crypto';
import type { OblivusPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';
import { logger } from "@/lib/logger";

const API_URL = 'https://api.oblivus.com/v2/cloud/metadata';
const SOURCE_URL = 'https://oblivus.com/pricing';

// API response types
interface GpuConfig {
    flavorID: string;
    type: string;
    vCPU: string;
    RAM: string;
    rootStorage: string;
    ephemeralStorage: string;
    CPU: string;
    GPUAmount: string;
}

interface GpuType {
    metaName: string;
    hourlyCost: string;
    network: string;
    configurations: GpuConfig[];
}

interface MetadataResponse {
    status: string;
    code: number;
    data: {
        gpu: Record<string, GpuType>;
    };
}

// GPU VRAM lookup - verified from NVIDIA specs
// https://www.nvidia.com/en-us/data-center/h100/
// https://www.nvidia.com/en-us/data-center/a100/
// https://www.nvidia.com/en-us/data-center/l40/
// https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4090/
// https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/
// https://www.nvidia.com/en-us/design-visualization/rtx-a6000/
const GPU_VRAM_GB: Record<string, number> = {
    'H100 80GB SXM5': 80,      // H100 SXM5: 80GB HBM3
    'H100 80GB NVLINK': 80,    // H100 NVL: 80GB HBM3
    'H100 80GB PCIE': 80,      // H100 PCIe: 80GB HBM3
    'A100 80GB NVLINK': 80,    // A100 SXM: 80GB HBM2e
    'A100 80GB PCIE': 80,      // A100 PCIe: 80GB HBM2e
    'L40': 48,                 // L40: 48GB GDDR6
    'RTX 4090': 24,            // RTX 4090: 24GB GDDR6X
    'RTX 5090': 32,            // RTX 5090: 32GB GDDR7
    'RTX 5090 32GB': 32,       // RTX 5090: 32GB GDDR7 (alternate naming)
    'RTX A6000': 48,           // RTX A6000: 48GB GDDR6
};

class OblivusScraper implements ProviderScraper {
    name = 'oblivus';
    url = SOURCE_URL;
    scrapeIntervalMinutes = 1440; // Daily
    enabled = true;

    private apiKey: string;

    constructor() {
        this.apiKey = process.env.OBLIVIOUS_KEY || '';
    }

    async scrape(): Promise<ProviderResult> {
        if (!this.apiKey) {
            throw new Error('OBLIVIOUS_KEY environment variable is required');
        }

        try {
            logger.info('[OblivusScraper] Fetching GPU metadata...');
            const observedAt = new Date().toISOString();

            const response = await fetch(API_URL, {
                method: 'GET',
                headers: {
                    'apiKey': this.apiKey,
                },
                redirect: 'follow',
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data: MetadataResponse = await response.json();

            if (data.status !== 'SUCCESS') {
                throw new Error(`API returned error: ${data.status}`);
            }

            const rows: OblivusPriceRow[] = [];

            // Process each GPU type
            for (const [gpuKey, gpuData] of Object.entries(data.data.gpu)) {
                const hourlyCostPerGpu = parseFloat(gpuData.hourlyCost);
                // Normalize GPU model name: strip VRAM, normalize PCIe, add NVIDIA prefix
                const gpuModel = this.normalizeGpuModel(gpuData.metaName);
                const network = gpuData.network;

                // Process each configuration
                for (const config of gpuData.configurations) {
                    const gpuCount = parseInt(config.GPUAmount, 10);
                    if (gpuCount <= 0) continue;

                    // Total price = price per GPU * GPU count
                    const totalPrice = hourlyCostPerGpu * gpuCount;

                    // Total VRAM = VRAM per GPU * GPU count
                    const vramPerGpu = GPU_VRAM_GB[gpuData.metaName] || 0;
                    const totalVram = vramPerGpu * gpuCount;

                    const row: OblivusPriceRow = {
                        provider: 'oblivus',
                        source_url: SOURCE_URL,
                        observed_at: observedAt,
                        instance_id: config.flavorID,
                        gpu_model: gpuModel,
                        gpu_count: gpuCount,
                        vram_gb: totalVram,
                        vcpus: parseInt(config.vCPU, 10),
                        system_ram_gb: parseInt(config.RAM, 10),
                        storage_gb: parseInt(config.rootStorage, 10) + parseInt(config.ephemeralStorage, 10),
                        price_unit: 'gpu_hour',
                        price_hour_usd: totalPrice,
                        currency: 'USD',
                        network: network,
                        class: 'GPU',
                        type: 'Virtual Machine',
                    };

                    rows.push(row);
                }
            }

            logger.info(`[OblivusScraper] Scraped ${rows.length} GPU configurations`);

            return {
                provider: 'oblivus',
                rows,
                observedAt,
                sourceHash: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
            };
        } catch (error) {
            throw new Error(`Oblivus scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Normalize GPU model name for consistent display.
     * - Strip VRAM suffix (e.g., "80GB") - it's in separate column
     * - Normalize PCIE to PCIe
     * - Add NVIDIA prefix
     */
    private normalizeGpuModel(metaName: string): string {
        // Strip VRAM suffix (e.g., "H100 80GB SXM5" -> "H100 SXM5")
        let normalized = metaName.replace(/\s*\d+GB\s*/gi, ' ').trim();
        // Clean up any double spaces
        normalized = normalized.replace(/\s+/g, ' ');
        // Normalize PCIE to PCIe
        normalized = normalized.replace(/\bPCIE\b/gi, 'PCIe');
        // Strip NVLink from model name
        normalized = normalized.replace(/\s+NVLink\b/gi, '');
        // Add NVIDIA prefix
        if (!normalized.toLowerCase().startsWith('nvidia')) {
            normalized = 'NVIDIA ' + normalized;
        }
        return normalized;
    }
}

export const oblivusScraper = new OblivusScraper();
