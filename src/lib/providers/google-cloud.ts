import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { GoogleCloudPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';
import { logger } from "@/lib/logger";

const PRICING_URL = 'https://cloud.google.com/products/compute/pricing/accelerator-optimized';

// GPU model mappings from machine family prefixes — used for consistent naming
const GPU_MODEL_MAP: Record<string, string> = {
    'a4-highgpu': 'NVIDIA B200',
    'a3-ultragpu': 'NVIDIA H200',
    'a3-megagpu': 'NVIDIA H100 SXM',
    'a3-highgpu': 'NVIDIA H100 SXM',
    'a2-ultragpu': 'NVIDIA A100',
    'a2-highgpu': 'NVIDIA A100',
    'a2-megagpu': 'NVIDIA A100',
    'g2-standard': 'NVIDIA L4',
    'g4-standard': 'NVIDIA RTX 6000 Ada',
};

// Per-GPU VRAM in GB - verified from NVIDIA specs
const GPU_VRAM_GB: Record<string, number> = {
    'a4-highgpu': 192,    // B200: 192GB HBM3e
    'a3-ultragpu': 141,   // H200: 141GB HBM3e
    'a3-megagpu': 80,     // H100 SXM: 80GB HBM3
    'a3-highgpu': 80,     // H100 SXM: 80GB HBM3
    'a2-ultragpu': 80,    // A100 80GB
    'a2-highgpu': 40,     // A100 40GB
    'a2-megagpu': 80,     // A100 80GB (mega uses 80GB A100)
    'g2-standard': 24,    // L4: 24GB GDDR6
    'g4-standard': 48,    // RTX 6000 Ada: 48GB GDDR6
};

// Machine family display names
const MACHINE_FAMILY_MAP: Record<string, string> = {
    'a4-highgpu': 'A4 High',
    'a3-ultragpu': 'A3 Ultra',
    'a3-megagpu': 'A3 Mega',
    'a3-highgpu': 'A3 High',
    'a2-ultragpu': 'A2 Ultra',
    'a2-highgpu': 'A2 Standard',
    'a2-megagpu': 'A2 Mega',
    'g2-standard': 'G2 Standard',
    'g4-standard': 'G4 Standard',
};

class GoogleCloudScraper implements ProviderScraper {
    name = 'googlecloud';
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
                redirect: 'follow',
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch Google Cloud pricing page: ${response.status}`);
            }

            const html = await response.text();
            const sourceHash = crypto.createHash('sha256').update(html).digest('hex');

            const $ = cheerio.load(html);
            const rows = this.parseAcceleratorTables($);

            logger.info(`[GoogleCloudScraper] Raw parsed rows: ${rows.length}`);

            // Deduplicate by instance_id
            const seenIds = new Set<string>();
            const uniqueRows = rows.filter(row => {
                const key = row.instance_id || `${row.gpu_model}-${row.gpu_count}`;
                if (seenIds.has(key)) {
                    return false;
                }
                seenIds.add(key);
                return true;
            });

            logger.info(`[GoogleCloudScraper] Unique rows after dedup: ${uniqueRows.length}`);

            return {
                provider: "googlecloud",
                rows: uniqueRows,
                observedAt: new Date().toISOString(),
                sourceHash,
            };
        } catch (error) {
            throw new Error(`Google Cloud scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Parse accelerator-optimized pricing tables.
     * Table columns: Machine type (0) | GPU (1) | Components (2) | On-Demand (3) | ...
     */
    private parseAcceleratorTables($: cheerio.CheerioAPI): GoogleCloudPriceRow[] {
        const rows: GoogleCloudPriceRow[] = [];
        const observedAt = new Date().toISOString();

        $('table').each((_: number, table: any) => {
            const $table = $(table);

            $table.find('tbody tr, tr').each((__: number, row: any) => {
                const $row = $(row);
                const cells = $row.find('td');

                if (cells.length < 3) return;

                const machineType = $(cells[0]).text().trim().toLowerCase();

                const familyPrefix = this.getMachineFamilyPrefix(machineType);
                if (!familyPrefix) return;

                const parsedRow = this.parseTableRow($, cells, machineType, familyPrefix, observedAt);
                if (parsedRow) {
                    rows.push(parsedRow);
                }
            });
        });

        return rows;
    }

    private getMachineFamilyPrefix(machineType: string): string | null {
        const prefixes = Object.keys(GPU_MODEL_MAP);
        for (const prefix of prefixes) {
            if (machineType.startsWith(prefix)) {
                return prefix;
            }
        }
        return null;
    }

    private parseTableRow(
        $: cheerio.CheerioAPI,
        cells: cheerio.Cheerio<any>,
        machineType: string,
        familyPrefix: string,
        observedAt: string
    ): GoogleCloudPriceRow | null {
        const gpuModel = GPU_MODEL_MAP[familyPrefix] || 'Unknown GPU';
        const machineFamily = MACHINE_FAMILY_MAP[familyPrefix] || familyPrefix;

        // Parse specs from Components cell (idx 2)
        // Format: "GPUs: 8  vCPUs: 208  Memory: 1,872GB  SSD: 6,000 GiB"
        const componentsText = $(cells[2]).text().trim();
        const gpuCountMatch = componentsText.match(/GPUs?:\s*(\d+)/i);
        const gpuCount = gpuCountMatch ? parseInt(gpuCountMatch[1]) : 1;

        const vcpuMatch = componentsText.match(/vCPUs?:\s*(\d+)/i);
        const vcpus = vcpuMatch ? parseInt(vcpuMatch[1]) : undefined;

        const memMatch = componentsText.match(/Memory:\s*([\d,]+)\s*(?:GB|GiB)/i);
        const systemRamGb = memMatch ? parseInt(memMatch[1].replace(',', '')) : undefined;

        const storageMatch = componentsText.match(/([\d,]+)\s*(?:GiB|GB)\s*(?:SSD|storage)/i);
        const storage = storageMatch ? storageMatch[0] : undefined;

        // On-demand price at idx 3, fallback to DWS Flex at idx 4
        let priceHourUsd = 0;
        let rawCost = '';

        for (const idx of [3, 4]) {
            if (idx >= cells.length) continue;
            const text = $(cells[idx]).text().trim();
            if (text === 'N/A' || !text) continue;
            const priceMatch = text.match(/\$([\d,]+\.?\d*)/);
            if (priceMatch) {
                priceHourUsd = parseFloat(priceMatch[1].replace(',', ''));
                rawCost = text;
                break;
            }
        }

        if (priceHourUsd === 0) return null;

        return {
            provider: 'googlecloud',
            source_url: PRICING_URL,
            observed_at: observedAt,
            instance_id: machineType,
            sku: machineType,
            machine_family: machineFamily,
            gpu_model: gpuModel,
            gpu_count: gpuCount,
            vram_gb: this.getTotalVram(familyPrefix, gpuCount),
            vcpus,
            system_ram_gb: systemRamGb,
            storage,
            region: 'us-central1',
            price_unit: 'instance_hour',
            price_hour_usd: priceHourUsd,
            raw_cost: rawCost,
            class: 'GPU',
            type: 'Virtual Machine',
        };
    }

    private getTotalVram(familyPrefix: string, gpuCount: number): number | undefined {
        const vramPerGpu = GPU_VRAM_GB[familyPrefix];
        return vramPerGpu ? vramPerGpu * gpuCount : undefined;
    }
}

export const googleCloudScraper = new GoogleCloudScraper();
