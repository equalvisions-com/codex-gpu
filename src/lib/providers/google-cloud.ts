import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { GoogleCloudPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';
import { logger } from "@/lib/logger";

const PRICING_URL = 'https://cloud.google.com/compute/vm-instance-pricing';

// GPU model mappings from machine family prefixes (VRAM stripped for consistency)
const GPU_MODEL_MAP: Record<string, string> = {
    'a4-highgpu': 'NVIDIA B200',
    'a3-ultragpu': 'NVIDIA H200',
    'a3-megagpu': 'NVIDIA H100 SXM',
    'a3-highgpu': 'NVIDIA H100 SXM',
    'a2-ultragpu': 'NVIDIA A100',
    'a2-highgpu': 'NVIDIA A100',
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
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch Google Cloud pricing page: ${response.status}`);
            }

            const html = await response.text();
            const sourceHash = crypto.createHash('sha256').update(html).digest('hex');

            const $ = cheerio.load(html);
            const rows = this.parseAcceleratorSection($);

            logger.info(`[GoogleCloudScraper] Raw parsed rows: ${rows.length}`);

            // Log all instance_ids to identify duplicates
            const instanceIds = rows.map(r => r.instance_id);
            logger.info(`[GoogleCloudScraper] Instance IDs:`, instanceIds);

            // Find duplicates
            const idCounts = new Map<string, number>();
            for (const id of instanceIds) {
                const key = id || 'undefined';
                idCounts.set(key, (idCounts.get(key) || 0) + 1);
            }
            const duplicates = Array.from(idCounts.entries()).filter(([_, count]) => count > 1);
            if (duplicates.length > 0) {
                logger.info(`[GoogleCloudScraper] DUPLICATES FOUND:`, duplicates);
            }

            // Deduplicate by instance_id
            const seenIds = new Set<string>();
            const uniqueRows = rows.filter(row => {
                const key = row.instance_id || `${row.gpu_model}-${row.gpu_count}`;
                if (seenIds.has(key)) {
                    logger.info(`[GoogleCloudScraper] Skipping duplicate: ${key}`);
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
     * Parse tables within the Accelerator-optimized machine type family section.
     * We look for tables that contain GPU machine types (a2, a3, a4, g2, g4 prefixes).
     */
    private parseAcceleratorSection($: cheerio.CheerioAPI): GoogleCloudPriceRow[] {
        const rows: GoogleCloudPriceRow[] = [];
        const observedAt = new Date().toISOString();

        // Find all tables on the page
        $('table').each((_: number, table: any) => {
            const $table = $(table);

            // Look for tables with machine type patterns
            $table.find('tbody tr').each((__: number, row: any) => {
                const $row = $(row);
                const cells = $row.find('td');

                if (cells.length < 2) return;

                // Get the first cell which contains the machine type
                const machineType = $(cells[0]).text().trim().toLowerCase();

                // Check if this is a GPU machine type we care about
                const familyPrefix = this.getMachineFamilyPrefix(machineType);
                if (!familyPrefix) return;

                // Parse machine type details
                const parsedRow = this.parseTableRow($, cells, machineType, familyPrefix, observedAt);
                if (parsedRow) {
                    rows.push(parsedRow);
                }
            });
        });

        return rows;
    }

    /**
     * Get the machine family prefix if it's a GPU machine type we want
     */
    private getMachineFamilyPrefix(machineType: string): string | null {
        const prefixes = Object.keys(GPU_MODEL_MAP);
        for (const prefix of prefixes) {
            if (machineType.startsWith(prefix)) {
                return prefix;
            }
        }
        return null;
    }

    /**
     * Parse a single table row into a GoogleCloudPriceRow
     */
    private parseTableRow(
        $: cheerio.CheerioAPI,
        cells: cheerio.Cheerio<any>,
        machineType: string,
        familyPrefix: string,
        observedAt: string
    ): GoogleCloudPriceRow | null {
        // Get GPU model and family from prefix
        const gpuModel = GPU_MODEL_MAP[familyPrefix] || 'Unknown GPU';
        const machineFamily = MACHINE_FAMILY_MAP[familyPrefix] || familyPrefix;

        // Parse GPU count from machine type (e.g., a2-highgpu-1g -> 1, a2-highgpu-8g -> 8)
        const gpuCountMatch = machineType.match(/(\d+)g$/);
        let gpuCount = gpuCountMatch ? parseInt(gpuCountMatch[1]) : 1;

        // For g2-standard, GPU count is embedded differently (g2-standard-4 has 1 GPU, g2-standard-96 has 8)
        if (familyPrefix === 'g2-standard') {
            gpuCount = this.getG2GpuCount(machineType);
        }

        // For g4-standard, parse from machine type
        if (familyPrefix === 'g4-standard') {
            gpuCount = this.getG4GpuCount(machineType);
        }

        // Parse specs from cells
        // GCP tables typically have: Machine type | GPU | Components | On-Demand
        // We need to extract the on-demand price from the last relevant column
        let priceHourUsd = 0;
        let rawCost = '';
        let vcpus: number | undefined;
        let systemRamGb: number | undefined;
        let storage: string | undefined;

        // Iterate through cells to find price and specs
        cells.each((idx: number, cell: any) => {
            const text = $(cell).text().trim();

            // Look for on-demand price in column index 3
            // Table structure: Machine type (0), GPU (1), Components (2), On-Demand (3), 1yr CUD (4), 3yr CUD (5)
            // Require $ to avoid matching component numbers, and only use idx 3
            if (idx === 3) {
                const priceMatch = text.match(/\$([\d,]+\.?\d*)/);
                if (priceMatch) {
                    priceHourUsd = parseFloat(priceMatch[1].replace(',', ''));
                    rawCost = text;
                }
            }

            // Look for vCPU count - specifically "vCPUs:" pattern in Components cell
            const vcpuMatch = text.match(/vCPUs?:\s*(\d+)/i);
            if (vcpuMatch) {
                vcpus = parseInt(vcpuMatch[1]);
            }

            // Look for memory - specifically "Memory:" pattern to avoid matching SSD
            // Handle both GB and GiB units
            const memMatch = text.match(/Memory:\s*([\d,]+)\s*(?:GB|GiB)/i);
            if (memMatch) {
                systemRamGb = parseInt(memMatch[1].replace(',', ''));
            }

            // Look for storage
            const storageMatch = text.match(/([\d,]+)\s*(?:GiB|GB)\s*(?:SSD|storage)/i);
            if (storageMatch) {
                storage = text;
            }
        });

        // Skip if no valid price found
        if (priceHourUsd === 0) return null;

        return {
            provider: 'googlecloud',
            source_url: PRICING_URL,
            observed_at: observedAt,
            instance_id: machineType,
            sku: machineType, // Used for stable key generation
            machine_family: machineFamily,
            gpu_model: gpuModel,
            gpu_count: gpuCount,
            vram_gb: this.getTotalVram(familyPrefix, gpuCount),
            vcpus: vcpus,
            system_ram_gb: systemRamGb,
            storage: storage,
            region: 'us-central1', // Default region from initial page load
            price_unit: 'instance_hour',
            price_hour_usd: priceHourUsd,
            raw_cost: rawCost,
            class: 'GPU',
            type: 'Virtual Machine',
        };
    }

    /**
     * Get GPU count for G2 Standard machines
     * g2-standard-4: 1 GPU, g2-standard-8: 1 GPU, g2-standard-12: 1 GPU
     * g2-standard-16: 1 GPU, g2-standard-24: 2 GPUs, g2-standard-32: 1 GPU
     * g2-standard-48: 4 GPUs, g2-standard-96: 8 GPUs
     */
    private getG2GpuCount(machineType: string): number {
        const suffix = machineType.replace('g2-standard-', '');
        const size = parseInt(suffix);
        if (size >= 96) return 8;
        if (size >= 48) return 4;
        if (size >= 24 && size < 32) return 2;
        return 1;
    }

    /**
     * Get GPU count for G4 Standard machines
     */
    private getG4GpuCount(machineType: string): number {
        const suffix = machineType.replace('g4-standard-', '');
        const size = parseInt(suffix);
        if (size >= 384) return 4;
        if (size >= 192) return 2;
        return 1;
    }

    /**
     * Calculate total VRAM from family prefix and GPU count
     */
    private getTotalVram(familyPrefix: string, gpuCount: number): number | undefined {
        const vramPerGpu = GPU_VRAM_GB[familyPrefix];
        return vramPerGpu ? vramPerGpu * gpuCount : undefined;
    }
}

export const googleCloudScraper = new GoogleCloudScraper();
