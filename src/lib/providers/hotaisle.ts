import * as cheerio from 'cheerio';
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
// extracted from the "$X.XX/GPU/hr" text on each scrape.
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

class HotAisleScraper implements ProviderScraper {
    name = 'hotaisle';
    url = PRICING_URL;
    scrapeIntervalMinutes = 1440; // Daily
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        try {
            logger.info('[HotAisleScraper] Fetching HotAisle pricing page...');

            const response = await fetch(PRICING_URL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch HotAisle pricing page: ${response.status}`);
            }

            const html = await response.text();
            const sourceHash = crypto.createHash('sha256').update(html).digest('hex');
            const observedAt = new Date().toISOString();

            const rows = this.parsePricingPage(html, observedAt);

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

    private parsePricingPage(html: string, observedAt: string): HotAislePriceRow[] {
        const $ = cheerio.load(html);
        const pageText = $('body').text();

        // Sanity check: make sure we're on the right page
        if (!pageText.match(/MI300/i)) {
            logger.warn('[HotAisleScraper] Page does not mention MI300 — layout may have changed');
            return [];
        }

        // Extract base price per GPU per hour (e.g., "$1.99/GPU/hr")
        const basePriceMatch = pageText.match(/\$(\d+\.?\d*)\s*\/\s*GPU\s*\/\s*hr/i);
        const basePricePerGpu = basePriceMatch ? parseFloat(basePriceMatch[1]) : null;

        if (!basePricePerGpu) {
            logger.warn('[HotAisleScraper] Could not extract base price from page — skipping');
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
