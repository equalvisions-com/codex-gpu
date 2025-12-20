import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { FlyioPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';

const PRICING_URL = 'https://fly.io/gpu';

class FlyioScraper implements ProviderScraper {
    name = 'flyio';
    url = PRICING_URL;
    scrapeIntervalMinutes = 1440;
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        try {
            // Fetch the pricing page with proper browser headers
            const response = await fetch(this.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch Fly.io GPU pricing page: ${response.status}`);
            }

            const html = await response.text();
            const sourceHash = crypto.createHash('sha256').update(html).digest('hex');

            // Parse the HTML and extract pricing data
            const rows = this.parsePricingPage(html);

            return {
                provider: "flyio",
                rows,
                observedAt: new Date().toISOString(),
                sourceHash,
            };
        } catch (error) {
            throw new Error(`Fly.io scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private parsePricingPage(html: string): FlyioPriceRow[] {
        const rows: FlyioPriceRow[] = [];
        const observedAt = new Date().toISOString();

        const $ = cheerio.load(html);

        // Fly.io uses card-based layout for GPU pricing
        // Each card has class "card rounded-2xl" and contains GPU info
        $('.card.rounded-2xl').each((_, card) => {
            const $card = $(card);

            // GPU name + VRAM is in h2 (e.g., "NVIDIA L40S 48GB")
            const h2Text = $card.find('h2').text().trim().replace(/\s+/g, ' ');

            // Skip cards that don't look like GPU cards
            if (!h2Text.includes('NVIDIA') && !h2Text.includes('AMD')) {
                return;
            }

            // Parse GPU model and VRAM from h2 text
            // Format: "NVIDIA L40S 48GB" or "NVIDIA A100 80GB SXM"
            const vramMatch = h2Text.match(/(\d+)\s*GB/i);
            const vramGb = vramMatch ? parseInt(vramMatch[1]) : 0;

            // Extract GPU model - remove VRAM suffix since it's stored separately
            // "NVIDIA L40S 48GB" -> "NVIDIA L40S"
            // "NVIDIA A100 80GB SXM" -> "NVIDIA A100 SXM"
            let gpuModel = h2Text
                .replace(/\s*\d+\s*GB\s*/i, ' ')  // Remove VRAM (e.g., "48GB", "80GB")
                .replace(/\s+/g, ' ')              // Normalize whitespace
                .trim();

            // Extract price from violet text (e.g., "$1.25/hr")
            const priceText = $card.find('.text-violet-700').first().text().trim();
            const priceMatch = priceText.match(/\$([\d.]+)/);
            const priceHourUsd = priceMatch ? parseFloat(priceMatch[1]) : 0;

            // Skip cards without valid price
            if (priceHourUsd === 0) {
                return;
            }

            // Extract available regions
            const regions: string[] = [];
            $card.find('.flex.flex-wrap.gap-1 .text-xs').each((_, region) => {
                const regionCode = $(region).text().trim().toLowerCase();
                if (regionCode && regionCode.length <= 5) { // Region codes are short (ord, ams, etc.)
                    regions.push(regionCode);
                }
            });

            // Create instance ID from model name
            const instanceId = gpuModel.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

            rows.push({
                provider: 'flyio',
                source_url: PRICING_URL,
                observed_at: observedAt,
                instance_id: instanceId,
                gpu_model: gpuModel,
                gpu_count: 1, // Per GPU pricing
                vram_gb: vramGb,
                vcpus: 0,           // GPU is an add-on, CPU is configurable separately
                system_ram_gb: 0,   // GPU is an add-on, RAM is configurable separately
                price_unit: 'gpu_hour',
                price_hour_usd: priceHourUsd,
                raw_cost: priceText,
                regions: regions.length > 0 ? regions : undefined,
                class: 'GPU',
                type: 'Virtual Machine',
            });
        });

        return rows;
    }
}

// Export a singleton instance
export const flyioScraper = new FlyioScraper();
