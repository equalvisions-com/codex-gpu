import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { ThundercomputePriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';
import { logger } from "@/lib/logger";

const PRICING_URL = 'https://www.thundercompute.com/pricing';

class ThundercomputeScraper implements ProviderScraper {
    name = 'thundercompute';
    url = PRICING_URL;
    scrapeIntervalMinutes = 1440;
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        try {
            const response = await fetch(PRICING_URL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch Thundercompute pricing page: ${response.status}`);
            }

            const html = await response.text();
            const sourceHash = crypto.createHash('sha256').update(html).digest('hex');

            const $ = cheerio.load(html);
            const rows = this.parsePricingCards($);

            // Deduplicate by sku
            const seenIds = new Set<string>();
            const uniqueRows = rows.filter(row => {
                const key = row.sku || row.instance_id || `${row.gpu_model}-${row.tier}`;
                if (seenIds.has(key)) return false;
                seenIds.add(key);
                return true;
            });

            logger.info(`[ThundercomputeScraper] Parsed ${uniqueRows.length} GPU pricing rows`);

            return {
                provider: "thundercompute",
                rows: uniqueRows,
                observedAt: new Date().toISOString(),
                sourceHash,
            };
        } catch (error) {
            throw new Error(`Thundercompute scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Parse pricing cards from both Prototyping and Production tabs
     */
    private parsePricingCards($: cheerio.CheerioAPI): ThundercomputePriceRow[] {
        const rows: ThundercomputePriceRow[] = [];
        const observedAt = new Date().toISOString();

        // Parse all pricing cards on the page
        // Both tabs are in the DOM, we just need to find the cards
        $('.pricing-v2-card, [class*="pricing-card"], [class*="gpu-card"]').each((_: number, card: any) => {
            const $card = $(card);
            const parsedRow = this.parseCard($, $card, observedAt);
            if (parsedRow) {
                rows.push(parsedRow);
            }
        });

        // If no cards found with those classes, try finding price elements
        if (rows.length === 0) {
            this.parseAlternativeStructure($, rows, observedAt);
        }

        return rows;
    }

    /**
     * Parse a single pricing card
     */
    private parseCard(
        $: cheerio.CheerioAPI,
        $card: cheerio.Cheerio<any>,
        observedAt: string
    ): ThundercomputePriceRow | null {
        const cardText = $card.text();

        // Skip if no GPU-related content
        if (!this.isGpuCard(cardText)) return null;

        // Extract GPU model from card
        const gpuInfo = this.extractGpuInfo(cardText);
        if (!gpuInfo) return null;

        // Extract price (look for $X.XX pattern)
        const priceMatch = cardText.match(/\$(\d+\.?\d*)/);
        if (!priceMatch) return null;

        const priceHourUsd = parseFloat(priceMatch[1]);
        if (priceHourUsd === 0 || isNaN(priceHourUsd)) return null;

        // Determine tier from card content or parent
        const tier = this.determineTier($card, cardText);

        // Extract specs if available (from text), or use defaults based on tier
        let specs = this.extractSpecs(cardText);

        // Production tier has fixed specs: 18 vCPUs, 144GB RAM per GPU (from dashboard)
        if (tier === 'production') {
            specs = { vcpus: 18, ram: 144 };
        }

        // Generate SKU
        const sku = `${gpuInfo.model.toLowerCase().replace(/\s+/g, '-')}-${tier}`;

        return {
            provider: 'thundercompute',
            source_url: PRICING_URL,
            observed_at: observedAt,
            instance_id: gpuInfo.displayName,
            sku: sku,
            gpu_model: gpuInfo.model,
            gpu_count: 1, // All pricing is per-GPU
            vram_gb: gpuInfo.vram,
            vcpus: specs.vcpus,
            system_ram_gb: specs.ram,
            price_unit: 'instance_hour',
            price_hour_usd: priceHourUsd,
            raw_cost: `$${priceHourUsd}/hr`,
            tier: tier,
            class: 'GPU',
            type: 'Virtual Machine',
        };
    }

    /**
     * Alternative parsing for different HTML structures
     */
    private parseAlternativeStructure(
        $: cheerio.CheerioAPI,
        rows: ThundercomputePriceRow[],
        observedAt: string
    ): void {
        // Look for any elements containing GPU names and prices
        $('*').each((_: number, el: any) => {
            const $el = $(el);
            const text = $el.text();

            // Only process leaf-ish elements with GPU content
            if ($el.children().length > 5) return;
            if (!this.isGpuCard(text)) return;

            const gpuInfo = this.extractGpuInfo(text);
            if (!gpuInfo) return;

            const priceMatch = text.match(/\$(\d+\.?\d*)/);
            if (!priceMatch) return;

            const priceHourUsd = parseFloat(priceMatch[1]);
            if (priceHourUsd === 0 || isNaN(priceHourUsd)) return;

            const tier = this.determineTier($el, text);
            let specs = this.extractSpecs(text);

            // Production tier has fixed specs: 18 vCPUs, 144GB RAM per GPU (from dashboard)
            if (tier === 'production') {
                specs = { vcpus: 18, ram: 144 };
            }

            const sku = `${gpuInfo.model.toLowerCase().replace(/\s+/g, '-')}-${tier}`;

            // Avoid duplicates
            if (rows.some(r => r.sku === sku)) return;

            rows.push({
                provider: 'thundercompute',
                source_url: PRICING_URL,
                observed_at: observedAt,
                instance_id: gpuInfo.displayName,
                sku: sku,
                gpu_model: gpuInfo.model,
                gpu_count: 1,
                vram_gb: gpuInfo.vram,
                vcpus: specs.vcpus,
                system_ram_gb: specs.ram,
                price_unit: 'instance_hour',
                price_hour_usd: priceHourUsd,
                raw_cost: `$${priceHourUsd}/hr`,
                tier: tier,
                class: 'GPU',
                type: 'Virtual Machine',
            });
        });
    }

    /**
     * Check if card contains GPU-related content
     */
    private isGpuCard(text: string): boolean {
        const gpuPatterns = ['T4', 'A100', 'H100', 'L40', 'V100', 'Tesla', 'NVIDIA'];
        return gpuPatterns.some(p => text.toUpperCase().includes(p.toUpperCase()));
    }

    /**
     * Extract GPU info from text
     */
    private extractGpuInfo(text: string): { model: string; displayName: string; vram?: number } | null {
        const upperText = text.toUpperCase();

        if (upperText.includes('H100')) {
            return { model: 'NVIDIA H100', displayName: 'H100', vram: 80 };
        } else if (upperText.includes('A100') && upperText.includes('80')) {
            return { model: 'NVIDIA A100', displayName: 'A100 80GB', vram: 80 };
        } else if (upperText.includes('A100') && upperText.includes('40')) {
            return { model: 'NVIDIA A100', displayName: 'A100 40GB', vram: 40 };
        } else if (upperText.includes('A100')) {
            // Default A100 to 80GB if not specified, but check for "40" pattern more broadly
            const has40 = /40\s*GB|40GB/i.test(text);
            return {
                model: 'NVIDIA A100',
                displayName: has40 ? 'A100 40GB' : 'A100 80GB',
                vram: has40 ? 40 : 80
            };
        } else if (upperText.includes('T4') || upperText.includes('TESLA T4')) {
            return { model: 'NVIDIA Tesla T4', displayName: 'Tesla T4', vram: 16 };
        }

        return null;
    }

    /**
     * Determine pricing tier from context
     */
    private determineTier(
        $el: cheerio.Cheerio<any>,
        text: string
    ): 'prototyping' | 'production' {
        const lowerText = text.toLowerCase();

        // Check for production indicators
        if (lowerText.includes('production') || lowerText.includes('nvlink') || lowerText.includes('premium')) {
            return 'production';
        }

        // Check for prototyping indicators
        if (lowerText.includes('prototyping') || lowerText.includes('on-demand')) {
            return 'prototyping';
        }

        // Check parent elements for tab context
        const parentText = $el.parents('[class*="tab"]').text().toLowerCase();
        if (parentText.includes('production')) {
            return 'production';
        }

        // Default to prototyping
        return 'prototyping';
    }

    /**
     * Extract specs from card text
     */
    private extractSpecs(text: string): { vcpus?: number; ram?: number } {
        const specs: { vcpus?: number; ram?: number } = {};

        // Look for vCPU pattern (e.g., "4 vCPUs" or "24 vCPU")
        const vcpuMatch = text.match(/(\d+)\s*v?CPU/i);
        if (vcpuMatch) {
            specs.vcpus = parseInt(vcpuMatch[1]);
        }

        // Look for RAM pattern (e.g., "32GB RAM" or "220 GB RAM")
        const ramMatch = text.match(/(\d+)\s*GB\s*RAM/i);
        if (ramMatch) {
            specs.ram = parseInt(ramMatch[1]);
        }

        return specs;
    }
}

export const thundercomputeScraper = new ThundercomputeScraper();
