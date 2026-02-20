import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { TogetherAIPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';
import { logger } from "@/lib/logger";

const SOURCE_URL = 'https://www.together.ai/pricing';

// GPU specs from NVIDIA - verified
const GPU_SPECS: Record<string, { vramPerGpu: number; model: string }> = {
    'NVIDIA HGX H100 SXM': { vramPerGpu: 80, model: 'NVIDIA H100 SXM' },
    'NVIDIA HGX H200': { vramPerGpu: 141, model: 'NVIDIA H200' },
    'NVIDIA HGX B200': { vramPerGpu: 192, model: 'NVIDIA B200' },
};

class TogetherAIScraper implements ProviderScraper {
    name = 'togetherai';
    url = SOURCE_URL;
    scrapeIntervalMinutes = 1440; // Daily
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        try {
            logger.info('[TogetherAIScraper] Fetching pricing page...');
            const observedAt = new Date().toISOString();

            const response = await fetch(SOURCE_URL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch pricing page: ${response.status}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            const rows: TogetherAIPriceRow[] = [];

            // Parse the pricing table - look for table rows with GPU names
            $('table tbody tr').each((_, row) => {
                const cells = $(row).find('td');
                if (cells.length < 4) return;

                // First cell is GPU name, last cell is hourly price
                const gpuName = $(cells[0]).text().trim();
                const hourlyPriceText = $(cells[cells.length - 1]).text().trim();

                // Check if this is one of our target GPUs
                const specs = GPU_SPECS[gpuName];
                if (!specs) return;

                // Extract price from text like "$2.99"
                const priceMatch = hourlyPriceText.match(/\$(\d+\.?\d*)/);
                if (!priceMatch) return;

                const pricePerGpu = parseFloat(priceMatch[1]);
                if (pricePerGpu <= 0) return;

                const instanceId = `hgx-${specs.model.toLowerCase().replace(/nvidia\s+/i, '').replace(/\s+/g, '-')}-8x`;
                const clusterPrice = pricePerGpu * 8;
                const totalVram = specs.vramPerGpu * 8;

                logger.info(`[TogetherAIScraper] ${gpuName}: $${pricePerGpu}/GPU/hr → $${clusterPrice}/cluster/hr (8x)`);

                rows.push({
                    provider: 'togetherai',
                    source_url: SOURCE_URL,
                    observed_at: observedAt,
                    instance_id: instanceId,
                    gpu_model: specs.model,
                    gpu_count: 8,
                    vram_gb: totalVram,
                    price_unit: 'cluster_hour',
                    price_hour_usd: clusterPrice,
                    currency: 'USD',
                    class: 'GPU',
                    type: 'Virtual Machine',
                });
            });

            logger.info(`[TogetherAIScraper] Parsed ${rows.length} GPU cluster pricing rows`);

            return {
                provider: 'togetherai',
                rows,
                observedAt,
                sourceHash: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
            };
        } catch (error) {
            throw new Error(`Together AI scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export const togetheraiScraper = new TogetherAIScraper();
