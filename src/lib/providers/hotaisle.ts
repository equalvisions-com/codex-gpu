import crypto from 'crypto';
import type { HotAislePriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';
import { logger } from "@/lib/logger";

const PRICING_URL = 'https://hotaisle.xyz/pricing/';
const SOURCE_URL = 'https://hotaisle.xyz/pricing/';

// MI300X has 192GB VRAM per GPU
const MI300X_VRAM_GB = 192;

// Known GPU configurations from HotAisle pricing page.
// Specs are hardcoded because the page displays ranges ("8 or 13 CPU Cores",
// "64 - 102 CPU Cores") that aren't reliably parseable. Price is dynamic —
// extracted from the JS bundle on each scrape.
const GPU_CONFIGS: {
    gpuCount: number;
    vcpus: number;
    ramGb: number;
    storage: string;
    type: 'Virtual Machine' | 'Bare Metal';
}[] = [
    { gpuCount: 1, vcpus: 13, ramGb: 224, storage: '12TB NVMe', type: 'Virtual Machine' },
    { gpuCount: 2, vcpus: 26, ramGb: 448, storage: '12TB NVMe', type: 'Virtual Machine' },
    { gpuCount: 4, vcpus: 52, ramGb: 896, storage: '12TB NVMe', type: 'Virtual Machine' },
    { gpuCount: 8, vcpus: 102, ramGb: 2048, storage: '122TB NVMe', type: 'Bare Metal' },
];

const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
};

class HotAisleScraper implements ProviderScraper {
    name = 'hotaisle';
    url = PRICING_URL;
    scrapeIntervalMinutes = 1440; // Daily
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        try {
            logger.info('[HotAisleScraper] Fetching HotAisle pricing page...');

            // HotAisle is a client-side SPA (React/Vite) — the HTML is an empty
            // shell with a <div id="root">. All content lives in JS bundles.
            // Step 1: Fetch the HTML to discover the JS chunk URLs.
            // Step 2: Fetch the pricing page chunk and extract the price from it.
            const response = await fetch(PRICING_URL, { headers: FETCH_HEADERS });

            if (!response.ok) {
                throw new Error(`Failed to fetch HotAisle pricing page: ${response.status}`);
            }

            const html = await response.text();

            // Find all JS chunk URLs from the HTML
            const scriptMatches = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)];
            if (scriptMatches.length === 0) {
                throw new Error('No JS bundles found in HotAisle HTML');
            }

            // Fetch all JS chunks and concatenate to search for pricing data
            let bundleContent = '';
            for (const match of scriptMatches) {
                const chunkUrl = `https://hotaisle.xyz${match[1]}`;
                const chunkResponse = await fetch(chunkUrl, { headers: FETCH_HEADERS });
                if (chunkResponse.ok) {
                    bundleContent += await chunkResponse.text();
                }
            }

            const sourceHash = crypto.createHash('sha256').update(bundleContent).digest('hex');
            const observedAt = new Date().toISOString();

            const rows = this.parsePriceFromBundle(bundleContent, observedAt);

            logger.info(`[HotAisleScraper] Parsed ${rows.length} GPU instance pricing rows`);

            return {
                provider: 'hotaisle',
                rows,
                observedAt,
                sourceHash,
            };
        } catch (error) {
            throw new Error(`HotAisle scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private parsePriceFromBundle(bundle: string, observedAt: string): HotAislePriceRow[] {
        // Sanity check: make sure the bundle contains MI300 references
        if (!bundle.match(/MI300/i)) {
            logger.warn('[HotAisleScraper] JS bundle does not mention MI300 — site may have changed');
            return [];
        }

        // Extract price from bundle — matches patterns like:
        //   "$1.99/GPU/hr"  or  "$1.99/hr"  or  "Just $1.99/hr"
        const priceMatch = bundle.match(/\$(\d+\.?\d*)\/(?:GPU\/)?hr/i);
        const basePricePerGpu = priceMatch ? parseFloat(priceMatch[1]) : null;

        if (!basePricePerGpu) {
            logger.warn('[HotAisleScraper] Could not extract base price from JS bundle — skipping');
            return [];
        }

        logger.info(`[HotAisleScraper] Base price per GPU: $${basePricePerGpu}/hr`);

        // Generate rows from known configs × scraped price
        const rows: HotAislePriceRow[] = GPU_CONFIGS.map((config) => {
            const priceHourUsd = Math.round(basePricePerGpu * config.gpuCount * 100) / 100;
            const instanceId = `hotaisle-mi300x-${config.gpuCount}x${config.type === 'Bare Metal' ? '-baremetal' : ''}`;

            return {
                provider: 'hotaisle' as const,
                source_url: SOURCE_URL,
                observed_at: observedAt,
                instance_id: instanceId,
                gpu_model: 'AMD MI300X',
                gpu_count: config.gpuCount,
                vram_gb: MI300X_VRAM_GB * config.gpuCount,
                vcpus: config.vcpus,
                system_ram_gb: config.ramGb,
                storage: config.storage,
                price_unit: 'instance_hour' as const,
                price_hour_usd: priceHourUsd,
                raw_cost: `$${priceHourUsd.toFixed(2)}/hr`,
                class: 'GPU' as const,
                type: config.type,
            };
        });

        return rows;
    }
}

// Export singleton instance
export const hotaisleScraper = new HotAisleScraper();
