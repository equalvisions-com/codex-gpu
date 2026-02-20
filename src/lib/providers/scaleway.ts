import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { ScalewayPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';
import { logger } from "@/lib/logger";

const PRICING_URL = 'https://www.scaleway.com/en/pricing/gpu/';

// Default EUR to USD conversion rate (can be overridden via env)
const EUR_TO_USD = parseFloat(process.env.EURO_USD || '1.164');

class ScalewayScraper implements ProviderScraper {
    name = 'scaleway';
    url = PRICING_URL;
    scrapeIntervalMinutes = 1440;
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        try {
            logger.info(`[ScalewayScraper] Using EUR→USD rate: ${EUR_TO_USD}`);

            const response = await fetch(PRICING_URL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch Scaleway pricing page: ${response.status}`);
            }

            const html = await response.text();
            const sourceHash = crypto.createHash('sha256').update(html).digest('hex');

            const $ = cheerio.load(html);
            const rows = this.parseGpuTables($);

            // Deduplicate by sku
            const seenIds = new Set<string>();
            const uniqueRows = rows.filter(row => {
                const key = row.sku || row.instance_id || `${row.gpu_model}-${row.gpu_count}`;
                if (seenIds.has(key)) return false;
                seenIds.add(key);
                return true;
            });

            logger.info(`[ScalewayScraper] Parsed ${uniqueRows.length} GPU pricing rows`);

            return {
                provider: "scaleway",
                rows: uniqueRows,
                observedAt: new Date().toISOString(),
                sourceHash,
            };
        } catch (error) {
            throw new Error(`Scaleway scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Parse all GPU pricing tables on the page
     */
    private parseGpuTables($: cheerio.CheerioAPI): ScalewayPriceRow[] {
        const rows: ScalewayPriceRow[] = [];
        const observedAt = new Date().toISOString();

        // Find all tables on the page
        $('table').each((_: number, table: any) => {
            const $table = $(table);

            // Find header row to determine column indices
            const headers: string[] = [];
            $table.find('thead th, tr:first-child th').each((__: number, th: any) => {
                headers.push($(th).text().trim().toLowerCase());
            });

            // Find price column index (look for "price" and "hour")
            let priceColIndex = -1;
            let vcpuColIndex = -1;
            let ramColIndex = -1;

            headers.forEach((h, i) => {
                if (h.includes('price') && h.includes('hour')) priceColIndex = i;
                else if (h.includes('vcpu') || h === 'vcpu') vcpuColIndex = i;
                else if (h.includes('ram')) ramColIndex = i;
            });

            // Skip tables without hourly price column
            if (priceColIndex === -1) return;

            // Parse data rows
            $table.find('tbody tr').each((__: number, row: any) => {
                const $row = $(row);
                const cells = $row.find('td');

                if (cells.length < 5) return;

                const parsedRow = this.parseTableRow($, cells, observedAt, priceColIndex, vcpuColIndex, ramColIndex);
                if (parsedRow) {
                    rows.push(parsedRow);
                }
            });
        });

        return rows;
    }

    /**
     * Parse a table row into a ScalewayPriceRow
     * Uses column indices determined from table headers
     */
    private parseTableRow(
        $: cheerio.CheerioAPI,
        cells: cheerio.Cheerio<any>,
        observedAt: string,
        priceColIndex: number,
        vcpuColIndex: number,
        ramColIndex: number
    ): ScalewayPriceRow | null {
        const cellTexts = cells.map((_: number, cell: any) => $(cell).text().trim()).get();

        // Column 0 is always the instance name (SKU)
        const instanceName = cellTexts[0];
        if (!instanceName || !this.isGpuInstance(instanceName)) return null;

        // Parse GPU info from name
        const gpuInfo = this.parseInstanceName(instanceName);
        if (!gpuInfo) return null;

        // Get vCPUs from the identified column
        const vcpus = vcpuColIndex >= 0 ? this.parseNumber(cellTexts[vcpuColIndex]) : undefined;

        // Get RAM from the identified column
        const systemRamGb = ramColIndex >= 0 ? this.parseNumber(cellTexts[ramColIndex]) : undefined;

        // Get price from the identified Price (€/hour) column
        const priceText = cellTexts[priceColIndex] || '';
        const priceMatch = priceText.match(/€\s*([\d.,]+)/);
        if (!priceMatch) return null;

        const euroPrice = parseFloat(priceMatch[1].replace(',', '.'));
        if (isNaN(euroPrice) || euroPrice === 0) return null;

        // Convert EUR to USD
        const priceHourUsd = Math.round(euroPrice * EUR_TO_USD * 100) / 100;

        // Calculate total VRAM (per-GPU VRAM × GPU count)
        const totalVramGb = gpuInfo.vram ? gpuInfo.vram * gpuInfo.count : undefined;

        return {
            provider: 'scaleway',
            source_url: PRICING_URL,
            observed_at: observedAt,
            instance_id: instanceName,
            sku: instanceName,
            gpu_model: gpuInfo.model,
            gpu_count: gpuInfo.count,
            vram_gb: totalVramGb, // Total VRAM = per-GPU × count
            vcpus: vcpus,
            system_ram_gb: systemRamGb,
            price_unit: 'instance_hour',
            price_hour_usd: priceHourUsd,
            raw_cost: priceText,
            class: 'GPU',
            type: 'Virtual Machine',
        };
    }

    /**
     * Check if instance name indicates a GPU instance
     */
    private isGpuInstance(name: string): boolean {
        const gpuPatterns = ['L4', 'L40S', 'H100', 'B300', 'P100', 'RENDER', 'GPU'];
        return gpuPatterns.some(p => name.toUpperCase().includes(p));
    }

    /**
     * Parse instance name to extract GPU info
     * Examples: L4-1-24G, H100-2-80G, H100-SXM-4-80G, B300-SXM-8-288G
     */
    private parseInstanceName(name: string): { model: string; count: number; vram?: number } | null {
        // Pattern: [GPU]-[count]-[vram]G or [GPU]-SXM-[count]-[vram]G
        const upperName = name.toUpperCase();

        // Handle special cases
        if (upperName.includes('RENDER')) {
            return { model: 'NVIDIA Tesla P100', count: 1, vram: 16 };
        }

        // Extract GPU count from name
        const countMatch = name.match(/-(\d+)-\d+G$/i) || name.match(/-(\d+)G$/i);
        const count = countMatch ? parseInt(countMatch[1]) : 1;

        // Extract VRAM from name
        const vramMatch = name.match(/-(\d+)G$/i);
        const vram = vramMatch ? parseInt(vramMatch[1]) : undefined;

        // Determine GPU model
        let model = 'Unknown GPU';
        if (upperName.includes('B300')) {
            model = 'NVIDIA B300 SXM';
        } else if (upperName.includes('H100-SXM') || upperName.includes('H100SXM')) {
            model = 'NVIDIA H100 SXM';
        } else if (upperName.includes('H100')) {
            model = 'NVIDIA H100';
        } else if (upperName.includes('L40S')) {
            model = 'NVIDIA L40S';
        } else if (upperName.includes('L4')) {
            model = 'NVIDIA L4';
        } else if (upperName.includes('P100')) {
            model = 'NVIDIA Tesla P100';
        }

        if (model === 'Unknown GPU') return null;

        return { model, count, vram };
    }

    /**
     * Parse a number from text
     */
    private parseNumber(text: string): number | undefined {
        const match = text.match(/(\d+)/);
        return match ? parseInt(match[1]) : undefined;
    }
}

export const scalewayScraper = new ScalewayScraper();
