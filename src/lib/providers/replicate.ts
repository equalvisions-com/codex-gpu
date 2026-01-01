import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { ReplicatePriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';

const PRICING_URL = 'https://replicate.com/pricing';

class ReplicateScraper implements ProviderScraper {
    name = 'replicate';
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
                throw new Error(`Failed to fetch Replicate pricing page: ${response.status}`);
            }

            const html = await response.text();
            const sourceHash = crypto.createHash('sha256').update(html).digest('hex');

            const $ = cheerio.load(html);
            const rows = this.parseHardwareTable($);

            // Deduplicate by sku
            const seenIds = new Set<string>();
            const uniqueRows = rows.filter(row => {
                const key = row.sku || row.instance_id || `${row.gpu_model}-${row.gpu_count}`;
                if (seenIds.has(key)) return false;
                seenIds.add(key);
                return true;
            });

            console.log(`[ReplicateScraper] Parsed ${uniqueRows.length} GPU hardware rows`);

            return {
                provider: "replicate",
                rows: uniqueRows,
                observedAt: new Date().toISOString(),
                sourceHash,
            };
        } catch (error) {
            throw new Error(`Replicate scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Parse the hardware pricing table
     * Only parse the FIRST matching table (on-demand hardware)
     * Skip "Additional hardware" section which requires committed spend contracts
     */
    private parseHardwareTable($: cheerio.CheerioAPI): ReplicatePriceRow[] {
        const rows: ReplicatePriceRow[] = [];
        const observedAt = new Date().toISOString();
        let foundFirstTable = false;

        // Find table headers to determine column indices
        $('table').each((_: number, table: any) => {
            // Only process the first matching hardware table
            if (foundFirstTable) return;

            const $table = $(table);

            // Find header row
            const headers: string[] = [];
            $table.find('thead th, tr:first-child th').each((__: number, th: any) => {
                headers.push($(th).text().trim().toLowerCase());
            });

            // Look for hardware/price columns
            const hardwareColIndex = headers.findIndex(h => h.includes('hardware'));
            const priceColIndex = headers.findIndex(h => h.includes('price'));
            const gpuColIndex = headers.findIndex(h => h === 'gpu');
            const cpuColIndex = headers.findIndex(h => h === 'cpu');
            const gpuRamColIndex = headers.findIndex(h => h.includes('gpu ram'));
            const ramColIndex = headers.findIndex(h => h === 'ram');

            // Skip tables without hardware/price columns
            if (hardwareColIndex === -1 || priceColIndex === -1) return;

            // Mark that we found the first valid table
            foundFirstTable = true;
            console.log('[ReplicateScraper] Parsing first (on-demand) hardware table only');

            // Parse data rows
            $table.find('tbody tr').each((__: number, row: any) => {
                const $row = $(row);
                const cells = $row.find('td');

                if (cells.length < 2) return;

                const parsedRow = this.parseTableRow($, cells, observedAt, {
                    hardwareColIndex,
                    priceColIndex,
                    gpuColIndex,
                    cpuColIndex,
                    gpuRamColIndex,
                    ramColIndex,
                });
                if (parsedRow) {
                    rows.push(parsedRow);
                }
            });
        });

        return rows;
    }

    /**
     * Parse a table row into a ReplicatePriceRow
     */
    private parseTableRow(
        $: cheerio.CheerioAPI,
        cells: cheerio.Cheerio<any>,
        observedAt: string,
        indices: {
            hardwareColIndex: number;
            priceColIndex: number;
            gpuColIndex: number;
            cpuColIndex: number;
            gpuRamColIndex: number;
            ramColIndex: number;
        }
    ): ReplicatePriceRow | null {
        const cellTexts = cells.map((_: number, cell: any) => $(cell).text().trim()).get();

        // Get hardware name and slug from first column
        const hardwareCell = $(cells.get(indices.hardwareColIndex));
        const hardwareName = hardwareCell.text().trim();

        // Look for slug in code/span element
        const slug = hardwareCell.find('code, .slug, [class*="slug"]').text().trim() ||
            this.extractSlug(hardwareName);

        // Skip CPU-only rows (no GPU)
        if (!slug || !slug.startsWith('gpu-')) return null;

        // Get GPU count - first try to extract from hardware name (e.g., "4x Nvidia A100")
        // This is more reliable than the GPU column for "Additional hardware" rows
        let gpuCount = this.parseGpuCountFromHardwareName(hardwareName);

        // Fall back to GPU column if not found in name
        if (gpuCount === 0 && indices.gpuColIndex >= 0) {
            const gpuText = cellTexts[indices.gpuColIndex] || '';
            // Only use GPU column if it looks like a count (e.g., "1x", "2x"), not descriptive text
            if (/^\d+x?$/i.test(gpuText.trim())) {
                gpuCount = this.parseGpuCount(gpuText);
            }
        }

        // Default to 1 GPU if slug indicates GPU but count not found
        if (gpuCount === 0) {
            gpuCount = 1;
        }

        // Get price (per-hour)
        const priceText = cellTexts[indices.priceColIndex] || '';
        const priceHourUsd = this.parseHourlyPrice(priceText);
        if (priceHourUsd === 0) return null;

        // Get GPU VRAM
        const gpuRamText = indices.gpuRamColIndex >= 0 ? cellTexts[indices.gpuRamColIndex] : '';
        const vramGb = this.parseGb(gpuRamText);

        // Get system RAM
        const ramText = indices.ramColIndex >= 0 ? cellTexts[indices.ramColIndex] : '';
        const systemRamGb = this.parseGb(ramText);

        // Get CPU count
        const cpuText = indices.cpuColIndex >= 0 ? cellTexts[indices.cpuColIndex] : '';
        const vcpus = this.parseCount(cpuText);

        // Determine GPU model from slug or name
        const gpuModel = this.extractGpuModel(slug, hardwareName);

        return {
            provider: 'replicate',
            source_url: PRICING_URL,
            observed_at: observedAt,
            instance_id: hardwareName,
            sku: slug,
            gpu_model: gpuModel,
            gpu_count: gpuCount,
            vram_gb: vramGb,
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
     * Extract slug from hardware name if not found in markup
     */
    private extractSlug(name: string): string {
        // Look for pattern like "gpu-h100" in the text
        const match = name.match(/(gpu-[a-z0-9-]+)/i);
        return match ? match[1].toLowerCase() : '';
    }

    /**
     * Extract GPU model from slug or name
     */
    private extractGpuModel(slug: string, name: string): string {
        const lowerSlug = slug.toLowerCase();
        const lowerName = name.toLowerCase();

        if (lowerSlug.includes('h100') || lowerName.includes('h100')) {
            return 'NVIDIA H100';
        } else if (lowerSlug.includes('a100') || lowerName.includes('a100')) {
            return 'NVIDIA A100';
        } else if (lowerSlug.includes('l40s') || lowerName.includes('l40s')) {
            return 'NVIDIA L40S';
        } else if (lowerSlug.includes('t4') || lowerName.includes('t4')) {
            return 'NVIDIA Tesla T4';
        }
        return 'Unknown GPU';
    }

    /**
     * Parse GPU count from hardware name (e.g., "4x Nvidia A100" -> 4)
     */
    private parseGpuCountFromHardwareName(name: string | undefined): number {
        if (!name) return 0;
        // Look for pattern like "4x" or "8x" at the start of the name
        const match = name.match(/^(\d+)x\s/i);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * Parse GPU count from text like "1x" or "2x"
     */
    private parseGpuCount(text: string | undefined): number {
        if (!text) return 0;
        const match = text.match(/(\d+)x?/i);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * Parse hourly price from text like "$5.49/hr" or "$0.001525/sec"
     */
    private parseHourlyPrice(text: string | undefined): number {
        if (!text) return 0;

        // Look for per-hour price first
        const hourMatch = text.match(/\$?([\d.]+)\s*\/\s*hr/i);
        if (hourMatch) {
            return parseFloat(hourMatch[1]);
        }

        // Look for per-second price and convert to hourly
        const secMatch = text.match(/\$?([\d.]+)\s*\/\s*sec/i);
        if (secMatch) {
            const perSec = parseFloat(secMatch[1]);
            return Math.round(perSec * 3600 * 100) / 100;
        }

        // Try to find any dollar amount
        const dollarMatch = text.match(/\$([\d.]+)/);
        return dollarMatch ? parseFloat(dollarMatch[1]) : 0;
    }

    /**
     * Parse GB from text like "80GB" or "144 GB"
     */
    private parseGb(text: string | undefined): number | undefined {
        if (!text) return undefined;
        const match = text.match(/(\d+)\s*GB/i);
        return match ? parseInt(match[1]) : undefined;
    }

    /**
     * Parse count from text like "4x" or "10"
     */
    private parseCount(text: string | undefined): number | undefined {
        if (!text) return undefined;
        const match = text.match(/(\d+)x?/);
        return match ? parseInt(match[1]) : undefined;
    }
}

export const replicateScraper = new ReplicateScraper();
