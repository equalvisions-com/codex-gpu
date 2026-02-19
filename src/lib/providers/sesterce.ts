import crypto from 'crypto';
import type { SestercePriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';

const API_URL = 'https://api.cloud.sesterce.com/gpu-cloud/instances/offers';
const PRICING_URL = 'https://www.sesterce.com/pricing';

// API response type
interface SesterceOffer {
    gpuName: string;
    gpuCount: number;
    hourlyPrice: number;
    instanceId: string;
    deploymentType: 'vm' | 'baremetal' | 'container';
    nvlink: boolean;
    configuration: {
        ramGB: number;
        storageGB: number;
        vCpu: number;
        vRamGB: number;
        os: string[];
        interconnect: string;
    };
    availability: Array<{
        name: string;
        region: string;
        countryCode: string | null;
        available: boolean;
    }>;
    cloud: {
        _id: string;
        name: string;
    };
    cloudInitAvailable: boolean;
}

class SesterceScraper implements ProviderScraper {
    name = 'sesterce';
    url = PRICING_URL;
    scrapeIntervalMinutes = 1440;
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        try {
            const apiKey = process.env.SESTERCE;
            if (!apiKey) {
                throw new Error('SESTERCE environment variable is not set');
            }

            const response = await fetch(API_URL, {
                headers: {
                    'X-API-KEY': apiKey,
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch Sesterce API: ${response.status} ${response.statusText}`);
            }

            const offers: SesterceOffer[] = await response.json();
            const sourceHash = crypto.createHash('sha256').update(JSON.stringify(offers)).digest('hex');
            const observedAt = new Date().toISOString();

            const rows = this.parseOffers(offers, observedAt);

            // Aggregate by GPU model + count + deployment type, keeping lowest price
            // This matches Sesterce website behavior (grouping by product, showing "Cost From")
            const aggregated = this.aggregateByLowestPrice(rows);

            console.log(`[SesterceScraper] Parsed ${aggregated.length} GPU pricing rows from API (${rows.length} raw offers aggregated)`);

            return {
                provider: 'sesterce',
                rows: aggregated,
                observedAt,
                sourceHash,
            };
        } catch (error) {
            throw new Error(`Sesterce scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Aggregate offers by GPU model + count + deployment type, keeping the lowest price
     */
    private aggregateByLowestPrice(rows: SestercePriceRow[]): SestercePriceRow[] {
        const grouped = new Map<string, SestercePriceRow>();

        for (const row of rows) {
            // Create unique key: GPU model + count + deployment type
            const key = `${row.gpu_model}-${row.gpu_count}-${row.deployment_type}`;

            const existing = grouped.get(key);
            if (!existing || row.price_hour_usd < existing.price_hour_usd) {
                grouped.set(key, row);
            }
        }

        return Array.from(grouped.values());
    }

    private parseOffers(offers: SesterceOffer[], observedAt: string): SestercePriceRow[] {
        const rows: SestercePriceRow[] = [];

        for (const offer of offers) {
            // Only include offers that are currently available in at least one region
            // This matches the Sesterce website behavior
            const isAvailable = offer.availability.some(a => a.available);
            if (!isAvailable) continue;

            const gpuModel = this.normalizeGpuModel(offer.gpuName);
            if (!gpuModel) continue; // Skip unknown GPU types

            const row: SestercePriceRow = {
                provider: 'sesterce',
                source_url: PRICING_URL,
                observed_at: observedAt,
                instance_id: offer.instanceId,
                sku: offer.instanceId,
                gpu_model: gpuModel,
                gpu_count: offer.gpuCount,
                vram_gb: offer.configuration.vRamGB,
                vcpus: offer.configuration.vCpu,
                system_ram_gb: offer.configuration.ramGB,
                storage_gb: offer.configuration.storageGB,
                nvlink: offer.nvlink,
                interconnect: offer.configuration.interconnect,
                deployment_type: offer.deploymentType,
                price_unit: 'instance_hour',
                price_hour_usd: offer.hourlyPrice,
                raw_cost: `$${offer.hourlyPrice.toFixed(2)}/hr`,
                class: 'GPU',
                type: offer.deploymentType === 'baremetal' ? 'Bare Metal' : 'Virtual Machine',
            };

            rows.push(row);
        }

        return rows;
    }

    /**
     * Normalize GPU model names to standard format
     */
    private normalizeGpuModel(gpuName: string): string | null {
        const upperName = gpuName.toUpperCase();

        // Blackwell series
        if (upperName === 'B300') return 'NVIDIA B300';
        if (upperName === 'B200') return 'NVIDIA B200';

        // Hopper series
        if (upperName === 'H200') return 'NVIDIA H200';
        if (upperName === 'H100') return 'NVIDIA H100';
        if (upperName === 'GH200') return 'NVIDIA GH200';

        // Ada Lovelace series
        if (upperName === 'L40S') return 'NVIDIA L40S';
        if (upperName === 'L40') return 'NVIDIA L40';
        if (upperName === 'L4') return 'NVIDIA L4';

        // RTX consumer/prosumer (with proper spacing)
        if (upperName === 'RTX4090') return 'NVIDIA RTX 4090';
        if (upperName === 'RTX5090') return 'NVIDIA RTX 5090';
        if (upperName === 'RTX6000ADA') return 'NVIDIA RTX 6000 Ada';
        if (upperName === 'RTX4000ADA') return 'NVIDIA RTX 4000 Ada';
        if (upperName === 'RTXPRO6000') return 'NVIDIA RTX PRO 6000';

        // Ampere series (VRAM comes from API's vRamGB field, not model name)
        if (upperName === 'A100' || upperName === 'A100_80G') return 'NVIDIA A100';
        if (upperName === 'A6000') return 'NVIDIA RTX A6000';
        if (upperName === 'A5000') return 'NVIDIA RTX A5000';
        if (upperName === 'A4000') return 'NVIDIA RTX A4000';
        if (upperName === 'A16') return 'NVIDIA A16';
        if (upperName === 'A10') return 'NVIDIA A10';
        if (upperName === 'A10G') return 'NVIDIA A10G';

        // Tesla/Volta series (VRAM comes from API's vRamGB field, not model name)
        if (upperName === 'V100' || upperName === 'V100_32G') return 'NVIDIA Tesla V100';
        if (upperName === 'T4') return 'NVIDIA T4';

        // Default: prefix with NVIDIA if looks like a GPU
        if (/^[A-Z][0-9]+/.test(upperName) || /^RTX/.test(upperName)) {
            return `NVIDIA ${gpuName}`;
        }

        return null;
    }
}

export const sesterceScraper = new SesterceScraper();
