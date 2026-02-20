import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { HotAislePriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';
import { logger } from "@/lib/logger";

const PRICING_URL = 'https://hotaisle.xyz/pricing/';
const SOURCE_URL = 'https://hotaisle.xyz/pricing/';

// MI300X has 192GB VRAM per GPU
const MI300X_VRAM_GB = 192;

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
        const rows: HotAislePriceRow[] = [];
        const seenInstances = new Set<string>();
        const $ = cheerio.load(html);

        // Extract base price per GPU per hour (e.g., "$1.99/GPU/hr")
        const pageText = $('body').text();
        const basePriceMatch = pageText.match(/\$(\d+\.?\d*)\s*\/\s*GPU\s*\/\s*hr/i);
        const basePricePerGpu = basePriceMatch ? parseFloat(basePriceMatch[1]) : 1.99; // Default fallback

        logger.info(`[HotAisleScraper] Base price per GPU: $${basePricePerGpu}/hr`);

        // Parse GPU configurations from page text
        // Patterns: "1x 192GB MI300x VM", "2x, 4x 192GB MI300x VM", "8x 192GB MI300x Bare Metal"

        // Find all text containing MI300 configurations
        $('*').each((_, elem) => {
            const text = $(elem).text();

            // Skip if text is too long (likely a parent container)
            if (text.length > 500) return;

            // Look for MI300x mentions with GPU counts
            // Handle both single (1x) and multi (2x, 4x) patterns
            const configPattern = /((?:\d+x,?\s*)+)\s*(?:\d+GB)?\s*(MI\d+[Xx]?)\s*(Virtual Machine|Bare Metal|VM)?/gi;

            const matches = [...text.matchAll(configPattern)];
            for (const match of matches) {
                const gpuCountsStr = match[1]; // e.g., "2x, 4x" or "1x"
                const gpuModel = match[2].toUpperCase(); // MI300X
                const instanceType = match[3] || 'Virtual Machine';

                // Extract all GPU counts from the string (e.g., "2x, 4x" -> [2, 4])
                const countMatches = gpuCountsStr.match(/(\d+)x/gi) || [];

                for (const countMatch of countMatches) {
                    const gpuCount = parseInt(countMatch, 10);
                    if (gpuCount <= 0) continue;

                    const configKey = `${gpuCount}x-${gpuModel}-${instanceType.includes('Bare') ? 'baremetal' : 'vm'}`;

                    if (!seenInstances.has(configKey)) {
                        seenInstances.add(configKey);

                        // Calculate specs based on GPU count
                        // From page: 1x=13cores/224GB, 2x=26cores/448GB, 4x=52cores/896GB, 8x=102cores/2048GB
                        let vcpus = 0;
                        let systemRamGb = 0;
                        let storage = '12TB NVMe';

                        switch (gpuCount) {
                            case 1:
                                vcpus = 13;
                                systemRamGb = 224;
                                break;
                            case 2:
                                vcpus = 26;
                                systemRamGb = 448;
                                break;
                            case 4:
                                vcpus = 52;
                                systemRamGb = 896;
                                break;
                            case 8:
                                vcpus = 102;
                                systemRamGb = 2048;
                                storage = '122TB NVMe';
                                break;
                            default:
                                vcpus = Math.round(13 * gpuCount);
                                systemRamGb = gpuCount * 224;
                        }

                        const priceHourUsd = Math.round(basePricePerGpu * gpuCount * 100) / 100;
                        const instanceId = `hotaisle-${gpuModel.toLowerCase()}-${gpuCount}x${instanceType.includes('Bare') ? '-baremetal' : ''}`;

                        rows.push({
                            provider: 'hotaisle',
                            source_url: SOURCE_URL,
                            observed_at: observedAt,
                            instance_id: instanceId,
                            gpu_model: `AMD ${gpuModel}`,
                            gpu_count: gpuCount,
                            vram_gb: MI300X_VRAM_GB * gpuCount,
                            vcpus,
                            system_ram_gb: systemRamGb,
                            storage,
                            price_unit: 'instance_hour',
                            price_hour_usd: priceHourUsd,
                            raw_cost: `$${priceHourUsd.toFixed(2)}/hr`,
                            class: 'GPU',
                            type: instanceType.includes('Bare') ? 'Bare Metal' : 'Virtual Machine',
                        });
                    }
                }
            }
        });

        // Sort by GPU count for consistent ordering
        rows.sort((a, b) => {
            const countCompare = a.gpu_count - b.gpu_count;
            if (countCompare !== 0) return countCompare;
            // VMs before Bare Metal
            return a.type === 'Virtual Machine' ? -1 : 1;
        });

        return rows;
    }
}

// Export singleton instance
export const hotaisleScraper = new HotAisleScraper();
