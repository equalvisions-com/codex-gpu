import crypto from 'crypto';
import type { VastPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';

const API_URL = 'https://console.vast.ai/api/v0/bundles/';
const SOURCE_URL = 'https://vast.ai/';

// Vast.ai API response types
interface VastOffer {
    id: number;
    gpu_name: string;
    num_gpus: number;
    gpu_ram: number;              // MB per GPU
    gpu_total_ram: number;        // MB total
    cpu_cores_effective: number;
    cpu_ram: number;              // MB
    dph_total: number;            // Price per hour
    reliability: number;          // 0-1 score
    geolocation: string;          // e.g., "US, CA"
    verified: string;             // "verified" | "unverified"
    rentable: boolean;
    rented: boolean;
}

interface VastApiResponse {
    offers: VastOffer[];
}

class VastScraper implements ProviderScraper {
    name = 'vast';
    url = SOURCE_URL;
    scrapeIntervalMinutes = 60; // Hourly - Vast prices change frequently
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        const apiKey = process.env.VAST_AI;

        if (!apiKey) {
            throw new Error('VAST_AI environment variable not set');
        }

        try {
            console.log('[VastScraper] Fetching Vast.ai GPU offers...');

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    limit: 1000,
                    type: 'on-demand',
                    verified: { eq: true },
                    rentable: { eq: true },
                    rented: { eq: false },
                    reliability: { gte: 0.9 },
                    gpu_arch: { eq: 'nvidia' },
                    gpu_name: {
                        in: [
                            // High-end datacenter GPUs
                            'A800 PCIE', 'A100 PCIE', 'A100 SXM4', 'A100 SXM', 'A100X',
                            'B200', 'GH200 SXM',
                            'H100 NVL', 'H100 PCIE', 'H100 SXM',
                            'H200 NVL', 'H200',
                            // Professional GPUs
                            'A40', 'A30', 'A16', 'A10g', 'A10',
                            'L40S', 'L40', 'L4',
                            // Legacy Tesla GPUs
                            'Tesla K80', 'Tesla P100', 'Tesla P40', 'Tesla M40',
                            'Tesla P4', 'Tesla T4', 'Tesla V100',
                        ]
                    },
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Vast.ai API error: ${response.status} - ${errorText.substring(0, 200)}`);
            }

            const data: VastApiResponse = await response.json();
            const offers = data.offers || [];

            console.log(`[VastScraper] Received ${offers.length} offers from API`);

            const sourceHash = crypto.createHash('sha256')
                .update(JSON.stringify(offers))
                .digest('hex');
            const observedAt = new Date().toISOString();

            const rows = this.aggregateOffers(offers, observedAt);

            console.log(`[VastScraper] Aggregated to ${rows.length} unique GPU configurations`);

            return {
                provider: 'vast',
                rows,
                observedAt,
                sourceHash,
            };
        } catch (error) {
            throw new Error(`Vast.ai scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Aggregate individual machine offers by GPU config.
     * Vast returns many offers for the same GPU type - we keep lowest price per config.
     */
    private aggregateOffers(offers: VastOffer[], observedAt: string): VastPriceRow[] {
        // Group by gpu_name + num_gpus, keep lowest dph_total
        const bestByConfig = new Map<string, VastOffer>();

        for (const offer of offers) {
            // Skip invalid offers
            if (!offer.gpu_name || offer.num_gpus <= 0 || offer.dph_total <= 0) {
                continue;
            }

            // Normalize GPU name for consistent grouping
            const normalizedGpuName = this.normalizeGpuName(offer.gpu_name);
            const configKey = `${normalizedGpuName}-${offer.num_gpus}`;

            const existing = bestByConfig.get(configKey);
            if (!existing || offer.dph_total < existing.dph_total) {
                bestByConfig.set(configKey, offer);
            }
        }

        // Convert to VastPriceRow
        const rows: VastPriceRow[] = [];

        for (const [configKey, offer] of bestByConfig) {
            const normalizedGpuName = this.normalizeGpuName(offer.gpu_name);
            const instanceId = `vast-${normalizedGpuName.toLowerCase().replace(/\s+/g, '-')}-${offer.num_gpus}x`;

            // Convert MB to GB
            const vramGb = Math.round(offer.gpu_total_ram / 1024);
            const systemRamGb = Math.round(offer.cpu_ram / 1024);
            const vcpus = Math.round(offer.cpu_cores_effective); // Round fractional CPUs

            rows.push({
                provider: 'vast',
                source_url: SOURCE_URL,
                observed_at: observedAt,
                instance_id: instanceId,
                gpu_model: normalizedGpuName,
                gpu_count: offer.num_gpus,
                vram_gb: vramGb,
                vcpus,
                system_ram_gb: systemRamGb,
                price_unit: 'instance_hour',
                price_hour_usd: Math.round(offer.dph_total * 100) / 100, // Round to 2 decimals
                raw_cost: `$${offer.dph_total.toFixed(2)}/hr`,
                reliability: offer.reliability,
                geolocation: offer.geolocation,
                class: 'GPU',
                type: 'Virtual Machine',
            });
        }

        // Sort by GPU model then count for consistent ordering
        rows.sort((a, b) => {
            const nameCompare = a.gpu_model.localeCompare(b.gpu_model);
            if (nameCompare !== 0) return nameCompare;
            return a.gpu_count - b.gpu_count;
        });

        return rows;
    }

    /**
     * Normalize GPU names for consistent display.
     * Vast uses names like "RTX_4090" - convert to "RTX 4090"
     */
    private normalizeGpuName(name: string): string {
        // Replace underscores with spaces
        let normalized = name.replace(/_/g, ' ');

        // Add NVIDIA prefix if not present for consistent naming
        if (!normalized.toLowerCase().startsWith('nvidia') &&
            !normalized.toLowerCase().includes('tesla') &&
            !normalized.toLowerCase().includes('quadro')) {
            // Don't add prefix for RTX/GTX cards - they're obvious NVIDIA
        }

        return normalized;
    }
}

// Export singleton instance
export const vastScraper = new VastScraper();
