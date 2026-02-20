import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { KoyebPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';
import { logger } from "@/lib/logger";

const PRICING_URL = 'https://www.koyeb.com/pricing';

class KoyebScraper implements ProviderScraper {
    name = 'koyeb';
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
                throw new Error(`Failed to fetch Koyeb pricing page: ${response.status}`);
            }

            const html = await response.text();
            const sourceHash = crypto.createHash('sha256').update(html).digest('hex');

            const $ = cheerio.load(html);
            const rows = this.parseGpuTable($);

            // Deduplicate by sku
            const seenIds = new Set<string>();
            const uniqueRows = rows.filter(row => {
                const key = row.sku || row.instance_id || `${row.gpu_model}-${row.gpu_count}`;
                if (seenIds.has(key)) return false;
                seenIds.add(key);
                return true;
            });

            logger.info(`[KoyebScraper] Parsed ${uniqueRows.length} GPU pricing rows`);

            return {
                provider: "koyeb",
                rows: uniqueRows,
                observedAt: new Date().toISOString(),
                sourceHash,
            };
        } catch (error) {
            throw new Error(`Koyeb scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Parse GPU pricing from Koyeb's grid-cols-5 DIV layout
     * Structure: flat grid where every 5 divs = 1 row
     * Columns: INSTANCE TYPE (with VRAM), VCPU, RAM, DISK, PRICE
     */
    private parseGpuTable($: cheerio.CheerioAPI): KoyebPriceRow[] {
        const rows: KoyebPriceRow[] = [];
        const observedAt = new Date().toISOString();
        const seenSkus = new Set<string>();

        // Find the grid container with GPU pricing
        // The page uses grid-cols-5 with hidden 2xl:grid classes (visible on large screens only)
        // We need to find ALL grid-cols-5 containers and check their content
        const allGrids = $('div').filter((_: number, el: any) => {
            const className = $(el).attr('class') || '';
            return className.includes('grid-cols-5');
        });

        logger.info(`[KoyebScraper] Found ${allGrids.length} grid-cols-5 containers`);

        allGrids.each((_: number, container: any) => {
            const $container = $(container);
            const containerText = $container.text().toUpperCase();

            // Skip if doesn't contain GPU-related content (case-insensitive check)
            if (!containerText.includes('INSTANCE TYPE') || !containerText.includes('VCPU')) {
                return;
            }

            logger.info(`[KoyebScraper] Found GPU pricing container`);

            // Get all direct children (cells)
            const cells = $container.children();
            const cellCount = cells.length;

            logger.info(`[KoyebScraper] Container has ${cellCount} child cells`);

            // Skip header row (first 5 cells), process data rows (every 5 cells = 1 row)
            for (let i = 5; i < cellCount; i += 5) {
                // Ensure we have all 5 cells for this row
                if (i + 4 >= cellCount) break;

                const col1 = $(cells[i]).text().trim();     // INSTANCE TYPE + VRAM
                const col2 = $(cells[i + 1]).text().trim(); // VCPU
                const col3 = $(cells[i + 2]).text().trim(); // RAM
                const col4 = $(cells[i + 3]).text().trim(); // DISK
                const col5 = $(cells[i + 4]).text().trim(); // PRICE

                // Skip if no instance name
                if (!col1) continue;

                // Parse instance name and VRAM from col1
                // Format examples (with \n from browser converted to space by Cheerio):
                // - "RTX-4000-SFF-ADA 20GB VRAM"
                // - "2x A100 160GB VRAM"
                // - "A100 POPULAR 80GB VRAM" (may have badge text)
                // - "L4 24GB VRAM"

                // First, normalize the text (remove badge text like POPULAR, extra whitespace)
                let normalizedCol1 = col1.replace(/POPULAR/gi, '').replace(/\s+/g, ' ').trim();

                // Extract VRAM - IMPORTANT: Require space before the VRAM number
                // to avoid matching "100" from A100/H100
                const vramMatch = normalizedCol1.match(/\s(\d+)\s*GB\s*VRAM/i);

                // Extract instance name (everything before the VRAM spec)
                let instanceName = normalizedCol1;
                if (vramMatch) {
                    // Remove the VRAM part from instance name
                    instanceName = normalizedCol1.replace(/\s+\d+\s*GB\s*VRAM.*/i, '').trim();
                }
                const vram = vramMatch ? parseInt(vramMatch[1]) : undefined;

                // Skip non-GPU instances (CPU-only)
                if (!this.isGpuInstance(instanceName) && !vram) continue;

                // Parse GPU info from instance name
                const gpuInfo = this.parseGpuInfo(instanceName, col1);
                if (!gpuInfo) continue;

                // Parse vCPU
                const vcpus = parseInt(col2) || undefined;

                // Parse RAM (e.g., "32GB" or "180GB")
                const ramMatch = col3.match(/(\d+)/);
                const ram = ramMatch ? parseInt(ramMatch[1]) : undefined;

                // Parse price (e.g., "$0.70 /hr" or "REQUEST ACCESS")
                let priceHourUsd: number | null = null;
                let rawCost = col5;
                const priceMatch = col5.match(/\$(\d+\.?\d*)/);
                if (priceMatch) {
                    priceHourUsd = parseFloat(priceMatch[1]);
                    rawCost = `$${priceHourUsd}/hr`;
                } else if (col5.toLowerCase().includes('request')) {
                    rawCost = 'Request Access';
                }

                // Generate SKU
                const sku = instanceName.toLowerCase().replace(/\s+/g, '-');
                if (seenSkus.has(sku)) continue;
                seenSkus.add(sku);

                logger.info(`[KoyebScraper] Parsed row: ${instanceName}, GPU: ${gpuInfo.model} x${gpuInfo.count}, vCPU: ${vcpus}, RAM: ${ram}GB, Price: ${priceHourUsd}`);

                rows.push({
                    provider: 'koyeb',
                    source_url: PRICING_URL,
                    observed_at: observedAt,
                    instance_id: instanceName,
                    sku: sku,
                    gpu_model: gpuInfo.model,
                    gpu_count: gpuInfo.count,
                    vram_gb: vram || gpuInfo.vram,
                    vcpus: vcpus,
                    system_ram_gb: ram,
                    price_unit: 'instance_hour',
                    price_hour_usd: priceHourUsd,
                    raw_cost: rawCost,
                    class: 'GPU',
                    type: 'Virtual Machine',
                });
            }
        });

        return rows;
    }

    /**
     * Parse a table row
     */
    private parseTableRow(
        $: cheerio.CheerioAPI,
        $row: cheerio.Cheerio<any>,
        cells: cheerio.Cheerio<any>,
        observedAt: string
    ): KoyebPriceRow | null {
        const rowText = $row.text();

        // Must contain GPU-related content
        if (!this.isGpuInstance(rowText)) return null;

        // Get cell texts
        const cellTexts = cells.map((_: number, cell: any) => $(cell).text().trim()).get();

        // First cell usually has instance name
        const instanceName = cellTexts[0] || '';
        if (!instanceName) return null;

        // Parse GPU info from instance name
        const gpuInfo = this.parseGpuInfo(instanceName, rowText);
        if (!gpuInfo) return null;

        // Find price - look for $X.XX pattern
        let priceHourUsd: number | null = null;
        let rawCost = '';

        for (const text of cellTexts) {
            const priceMatch = text.match(/\$(\d+\.?\d*)/);
            if (priceMatch) {
                priceHourUsd = parseFloat(priceMatch[1]);
                rawCost = text;
                break;
            }
            // Check for "Request Access" or similar
            if (text.toLowerCase().includes('request') || text.toLowerCase().includes('contact')) {
                rawCost = text;
            }
        }

        // Extract specs from row
        const specs = this.extractSpecs(rowText);

        return {
            provider: 'koyeb',
            source_url: PRICING_URL,
            observed_at: observedAt,
            instance_id: instanceName,
            sku: instanceName.toLowerCase().replace(/\s+/g, '-'),
            gpu_model: gpuInfo.model,
            gpu_count: gpuInfo.count,
            vram_gb: gpuInfo.vram,
            vcpus: specs.vcpus,
            system_ram_gb: specs.ram,
            price_unit: 'instance_hour',
            price_hour_usd: priceHourUsd,
            raw_cost: rawCost || (priceHourUsd ? `$${priceHourUsd}/hr` : 'Request Access'),
            class: 'GPU',
            type: 'Virtual Machine',
        };
    }

    /**
     * Parse card-based layout
     */
    private parseCardLayout(
        $: cheerio.CheerioAPI,
        rows: KoyebPriceRow[],
        observedAt: string
    ): void {
        $('[class*="card"], [class*="pricing-item"], [class*="gpu"]').each((_: number, card: any) => {
            const $card = $(card);
            const cardText = $card.text();

            if (!this.isGpuInstance(cardText)) return;

            const gpuInfo = this.parseGpuInfo(cardText, cardText);
            if (!gpuInfo) return;

            // Find price
            let priceHourUsd: number | null = null;
            let rawCost = '';
            const priceMatch = cardText.match(/\$(\d+\.?\d*)/);
            if (priceMatch) {
                priceHourUsd = parseFloat(priceMatch[1]);
                rawCost = `$${priceHourUsd}/hr`;
            } else if (cardText.toLowerCase().includes('request')) {
                rawCost = 'Request Access';
            }

            const specs = this.extractSpecs(cardText);
            const instanceName = this.extractInstanceName(cardText, gpuInfo);

            // Avoid duplicates
            const sku = instanceName.toLowerCase().replace(/\s+/g, '-');
            if (rows.some(r => r.sku === sku)) return;

            rows.push({
                provider: 'koyeb',
                source_url: PRICING_URL,
                observed_at: observedAt,
                instance_id: instanceName,
                sku: sku,
                gpu_model: gpuInfo.model,
                gpu_count: gpuInfo.count,
                vram_gb: gpuInfo.vram,
                vcpus: specs.vcpus,
                system_ram_gb: specs.ram,
                price_unit: 'instance_hour',
                price_hour_usd: priceHourUsd,
                raw_cost: rawCost,
                class: 'GPU',
                type: 'Virtual Machine',
            });
        });
    }

    /**
     * Check if text indicates GPU instance
     */
    private isGpuInstance(text: string): boolean {
        const gpuPatterns = ['RTX', 'A100', 'H100', 'L4', 'L40', 'A6000', 'GPU', 'VRAM'];
        return gpuPatterns.some(p => text.toUpperCase().includes(p));
    }

    /**
     * Parse GPU info from instance name/text
     */
    private parseGpuInfo(name: string, fullText: string): { model: string; count: number; vram?: number } | null {
        const upperName = name.toUpperCase();
        const upperText = fullText.toUpperCase();

        // Extract GPU count from name (e.g., "2x A100" -> 2)
        let count = 1;
        const countMatch = name.match(/^(\d+)x\s/i);
        if (countMatch) {
            count = parseInt(countMatch[1]);
        }

        // Determine GPU model and VRAM (skip N300s - AMD instances not tracked)
        if (upperName.includes('N300')) {
            return null; // Skip AMD Instinct N300s
        } else if (upperName.includes('H200')) {
            return { model: 'NVIDIA H200', count, vram: 141 * count };
        } else if (upperName.includes('H100')) {
            return { model: 'NVIDIA H100', count, vram: 80 * count };
        } else if (upperName.includes('A100 SXM') || upperName.includes('A100-SXM')) {
            return { model: 'NVIDIA A100 SXM', count, vram: 80 * count };
        } else if (upperName.includes('A100')) {
            return { model: 'NVIDIA A100', count, vram: 80 * count };
        } else if (upperName.includes('L40S')) {
            return { model: 'NVIDIA L40S', count, vram: 48 * count };
        } else if (upperName.includes('L4')) {
            return { model: 'NVIDIA L4', count, vram: 24 * count };
        } else if (upperName.includes('RTX-A6000') || upperName.includes('A6000')) {
            return { model: 'NVIDIA RTX A6000', count, vram: 48 * count };
        } else if (upperName.includes('RTX-4000') || upperName.includes('RTX 4000')) {
            return { model: 'NVIDIA RTX 4000 Ada SFF', count, vram: 20 * count };
        }

        // Check full text as fallback
        if (upperText.includes('H200')) {
            return { model: 'NVIDIA H200', count, vram: 141 * count };
        } else if (upperText.includes('H100')) {
            return { model: 'NVIDIA H100', count, vram: 80 * count };
        } else if (upperText.includes('A100')) {
            return { model: 'NVIDIA A100', count, vram: 80 * count };
        }

        return null;
    }

    /**
     * Extract specs from text
     */
    private extractSpecs(text: string): { vcpus?: number; ram?: number } {
        const specs: { vcpus?: number; ram?: number } = {};

        // Look for vCPU pattern
        const vcpuMatch = text.match(/(\d+)\s*(?:vCPU|CPU)/i);
        if (vcpuMatch) {
            specs.vcpus = parseInt(vcpuMatch[1]);
        }

        // Look for RAM pattern (e.g., "32GB" or "180 GB")
        // Be careful not to match VRAM
        const ramMatch = text.match(/(\d+)\s*GB(?:\s*RAM)?/i);
        if (ramMatch) {
            specs.ram = parseInt(ramMatch[1]);
        }

        return specs;
    }

    /**
     * Extract instance name from text
     */
    private extractInstanceName(text: string, gpuInfo: { model: string; count: number }): string {
        // Try to find instance name pattern
        const patterns = [
            /\b(\d+x\s*[A-Z0-9-]+)\b/i,
            /\b([A-Z0-9-]+-[A-Z0-9-]+)\b/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && this.isGpuInstance(match[1])) {
                return match[1];
            }
        }

        // Generate from GPU info
        if (gpuInfo.count > 1) {
            return `${gpuInfo.count}x ${gpuInfo.model.replace('NVIDIA ', '')}`;
        }
        return gpuInfo.model.replace('NVIDIA ', '');
    }
}

export const koyebScraper = new KoyebScraper();
