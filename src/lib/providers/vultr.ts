import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { VultrPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';

const PRICING_URL = 'https://www.vultr.com/pricing/';

// Fallback pricing for Bare Metal GPU instances that show "Contact Sales"
// Pricing sourced from Vultr documentation where publicly available
const VULTR_BM_GPU_PRICING_FALLBACK: Record<string, number> = {
    // Key format: "gpu_model-gpu_count" (lowercase, hyphenated)
    // Note: Add fallback prices if discovered from public sources
};

// GPU models to look for - specific GPU model names (excludes generic 'AMD' to avoid CPU matches)
const GPU_KEYWORDS = ['NVIDIA', 'MI300', 'MI325', 'MI355', 'H100', 'H200', 'B200', 'A100', 'L40S', 'A40', 'A16', 'GH200', 'HGX'];

class VultrScraper implements ProviderScraper {
    name = 'vultr';
    url = PRICING_URL;
    scrapeIntervalMinutes = 1440;
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        try {
            // Fetch the pricing page with browser headers
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
                throw new Error(`Failed to fetch Vultr pricing page: ${response.status}`);
            }

            const html = await response.text();
            const sourceHash = crypto.createHash('sha256').update(html).digest('hex');

            // Parse Cloud GPU and Bare Metal sections
            const $ = cheerio.load(html);
            const cloudGpuRows = this.parseCloudGpuSection($);
            const bareMetalRows = this.parseBareMetalGpuSection($);

            const allRows = [...cloudGpuRows, ...bareMetalRows];

            // Deduplicate rows by instance_id (Vultr page has duplicate sections)
            const seenIds = new Set<string>();
            const rows = allRows.filter(row => {
                const key = row.instance_id || `${row.gpu_model}-${row.gpu_count}-${row.vram_gb}`;
                if (seenIds.has(key)) {
                    return false; // Skip duplicate
                }
                seenIds.add(key);
                return true;
            });

            console.log(`[VultrScraper] Scraped ${allRows.length} rows, deduplicated to ${rows.length} (Cloud GPU: ${cloudGpuRows.length}, Bare Metal: ${bareMetalRows.length})`);

            return {
                provider: "vultr",
                rows,
                observedAt: new Date().toISOString(),
                sourceHash,
            };
        } catch (error) {
            throw new Error(`Vultr scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Parse Cloud GPU section (#cloud-gpu)
     * Structure: Custom div-based grid with .pt (pricing table), .pt__row, .pt__cell
     * Columns: GPU Count | GPU RAM | vCPUs | RAM | Storage | Bandwidth | Price
     */
    private parseCloudGpuSection($: cheerio.CheerioAPI): VultrPriceRow[] {
        const rows: VultrPriceRow[] = [];
        const observedAt = new Date().toISOString();

        const cloudGpuSection = $('#cloud-gpu');
        if (!cloudGpuSection.length) {
            console.warn('[VultrScraper] Could not find #cloud-gpu section');
            return rows;
        }

        // Each .pricing__subsection contains a GPU model
        cloudGpuSection.find('.pricing__subsection').each((_: number, subsection: any) => {
            const $sub = $(subsection);

            // GPU model from h3 title (e.g., "NVIDIA H100" or "AMD MI355X")
            const titleText = $sub.find('h3').first().text().trim();
            // Clean up title: remove "Pricing" suffix and clean whitespace
            const gpuModel = titleText.replace(/\s*Pricing$/i, '').replace(/\s+/g, ' ').trim();

            if (!gpuModel) return;

            // Find the pricing table (.pt) and iterate rows (.pt__row)
            // Skip header row by filtering for rows with .pt__row-content
            $sub.find('.pt__row').each((_: number, row: any) => {
                const $row = $(row);

                // Get all cells from .pt__row-content
                const rowContent = $row.find('.pt__row-content');
                if (!rowContent.length) return; // Skip header rows

                const cells = rowContent.find('.pt__cell');
                if (cells.length < 7) return; // Skip malformed rows

                // Extract data from columns (0-indexed)
                // Columns: GPU Count | GPU RAM | vCPUs | RAM | Storage | Bandwidth | Price
                const gpuCountText = $(cells[0]).text().trim();
                const gpuRamText = $(cells[1]).text().trim();
                const vcpusText = $(cells[2]).text().trim();
                const ramText = $(cells[3]).text().trim();
                const storageText = $(cells[4]).text().trim();
                const bandwidthText = $(cells[5]).text().trim();
                const priceText = $(cells[6]).text().trim();

                // Skip fractional GPU configs (e.g., "1/8", "1/4", "1/2")
                // These are GPU slices, not full GPU instances
                if (gpuCountText.includes('/')) return;

                // Parse numeric values
                const gpuCount = parseInt(gpuCountText.replace(/[^\d]/g, '')) || 1;
                const vramGb = parseInt(gpuRamText.replace(/[^\d]/g, '')) || 0;
                const vcpus = parseInt(vcpusText.replace(/[^\d]/g, '')) || 0;
                const systemRamGb = parseInt(ramText.replace(/[^\d]/g, '')) || 0;

                // Parse price (e.g., "$2.590/GPU/hr" -> 2.59 per GPU)
                // Vultr prices are PER GPU, so multiply by gpu_count for total instance cost
                let priceHourUsd: number | undefined;
                let isContactSales = false;
                const isPerGpuPricing = priceText.toLowerCase().includes('/gpu');

                if (priceText.toLowerCase().includes('contact')) {
                    isContactSales = true;
                } else {
                    const priceMatch = priceText.match(/\$?([\d.]+)/);
                    if (priceMatch) {
                        const perGpuPrice = parseFloat(priceMatch[1]);
                        // Multiply by gpu_count if this is per-GPU pricing
                        priceHourUsd = isPerGpuPricing ? perGpuPrice * gpuCount : perGpuPrice;
                    }
                }

                // Skip if we don't have essential data
                if (vramGb === 0) return;

                // Create instance ID
                const instanceId = `cloud-gpu-${gpuModel.toLowerCase().replace(/\s+/g, '-')}-${gpuCount}x`;

                rows.push({
                    provider: 'vultr',
                    source_url: PRICING_URL,
                    observed_at: observedAt,
                    instance_id: instanceId,
                    gpu_model: gpuModel,
                    gpu_count: gpuCount,
                    vram_gb: vramGb,
                    vcpus: vcpus,
                    system_ram_gb: systemRamGb,
                    storage: storageText || 'Not specified',
                    bandwidth: bandwidthText || undefined,
                    price_unit: 'instance_hour', // Total instance cost, not per-GPU
                    ...(isContactSales ? { contact_sales: true } : { price_hour_usd: priceHourUsd }),
                    raw_cost: priceText || 'Contact sales',
                    class: 'GPU',
                    type: 'Virtual Machine',
                });
            });
        });

        return rows;
    }

    /**
     * Parse Bare Metal GPU section (#bare-metal)
     * Structure: .package cards with .package__title for GPU model and .package__list-item for specs
     * Only parse packages that contain GPU keywords
     */
    private parseBareMetalGpuSection($: cheerio.CheerioAPI): VultrPriceRow[] {
        const rows: VultrPriceRow[] = [];
        const observedAt = new Date().toISOString();

        const bareMetalSection = $('#bare-metal');
        if (!bareMetalSection.length) {
            console.warn('[VultrScraper] Could not find #bare-metal section');
            return rows;
        }

        // Parse .package cards - these are the plan cards
        bareMetalSection.find('.package').each((_: number, pkg: any) => {
            const $pkg = $(pkg);

            // Get the package title (potential GPU model name)
            const titleText = $pkg.find('.package__title').first().text().trim();

            // Get all list items for specs parsing
            const listItems = $pkg.find('.package__list-item');
            const specsArray = listItems.map((_: number, item: any) => $(item).text().trim()).get();
            const specsText = specsArray.join(' ');

            // Dynamic GPU detection: GPU packages have first spec matching pattern:
            // "N x [BRAND] [MODEL] [VRAM] GB" (e.g., "8 x NVIDIA B200 192 GB" or "8 x AMD MI355X 288 GB")
            // CPU packages have different patterns like "2 x 960 GB NVMe" or "6 Cores / 12 Threads"
            const firstSpec = specsArray[0] || '';

            // Pattern: digit(s) + "x" + (NVIDIA or AMD) + model name + digit(s) + "GB"
            const gpuSpecPattern = /\d+\s*x\s*(?:NVIDIA|AMD)\s+[\w\s]+\d+\s*GB/i;
            const hasGpuInFirstSpec = gpuSpecPattern.test(firstSpec);

            // Skip CPU-only packages
            if (!hasGpuInFirstSpec) return;

            const gpuModel = titleText.replace(/\s+/g, ' ').trim();

            // Extract GPU count and VRAM from specs (e.g., "8 x AMD MI355X 288 GB")
            const gpuSpecMatch = specsText.match(/(\d+)\s*x\s*(?:NVIDIA|AMD)\s*[\w\s]+?\s*(\d+)\s*GB/i);
            let gpuCount = 1;
            let vramGb = 0;

            if (gpuSpecMatch) {
                gpuCount = parseInt(gpuSpecMatch[1]) || 1;
                vramGb = parseInt(gpuSpecMatch[2]) || 0;
            } else {
                // Try simpler patterns
                const countMatch = specsText.match(/(\d+)\s*x/i);
                const vramMatch = specsText.match(/(\d+)\s*GB/i);
                if (countMatch) gpuCount = parseInt(countMatch[1]);
                if (vramMatch) vramGb = parseInt(vramMatch[1]);
            }

            // Extract vCPUs/cores (e.g., "64 Cores / 128 Threads" or "252 vCPUs")
            const cpuMatch = specsText.match(/(\d+)\s*(?:Cores?|vCPUs?|Threads?)/i);
            const vcpus = cpuMatch ? parseInt(cpuMatch[1]) : 0;

            // Extract RAM (e.g., "3 TB RAM" or "2872 GB RAM")
            const ramMatch = specsText.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\s*RAM/i);
            let systemRamGb = 0;
            if (ramMatch) {
                systemRamGb = parseFloat(ramMatch[1]);
                if (ramMatch[2].toUpperCase() === 'TB') {
                    systemRamGb = Math.round(systemRamGb * 1024);
                }
            }

            // Extract storage (e.g., "7.68 TB NVMe" or "14.34 TB SSD")
            const storageMatch = specsText.match(/(\d+(?:\.\d+)?)\s*TB\s*(?:NVMe|SSD|storage)/i);
            const storage = storageMatch ? `${storageMatch[1]} TB NVMe` : 'Not specified';

            // Extract price from .package__price
            // Bare Metal GPU prices are also per-GPU per-hour
            const priceText = $pkg.find('.package__price').text().trim();
            let priceHourUsd: number | undefined;
            let isContactSales = priceText.toLowerCase().includes('contact') || !priceText;

            if (!isContactSales) {
                const priceMatch = priceText.match(/\$?([\d.]+)/);
                if (priceMatch) {
                    const perGpuPrice = parseFloat(priceMatch[1]);
                    // Multiply by gpu_count for total instance cost
                    priceHourUsd = perGpuPrice * gpuCount;
                }
            }

            // Check fallback pricing
            if (isContactSales || priceHourUsd === undefined) {
                const fallbackKey = `${gpuModel.toLowerCase().replace(/\s+/g, '-')}-${gpuCount}`;
                const fallbackPrice = VULTR_BM_GPU_PRICING_FALLBACK[fallbackKey];
                if (fallbackPrice) {
                    priceHourUsd = fallbackPrice * gpuCount; // Fallback is also per-GPU
                    isContactSales = false;
                }
            }

            // Skip if we don't have meaningful GPU data
            if (vramGb === 0 && gpuCount === 0) return;

            const instanceId = `bare-metal-${gpuModel.toLowerCase().replace(/\s+/g, '-')}-${gpuCount}x`;

            rows.push({
                provider: 'vultr',
                source_url: PRICING_URL,
                observed_at: observedAt,
                instance_id: instanceId,
                gpu_model: gpuModel,
                gpu_count: gpuCount,
                vram_gb: vramGb,
                vcpus: vcpus,
                system_ram_gb: systemRamGb,
                storage: storage,
                price_unit: 'instance_hour', // Total instance cost, not per-GPU
                ...(isContactSales ? { contact_sales: true } : { price_hour_usd: priceHourUsd }),
                raw_cost: priceText || 'Contact sales',
                class: 'GPU',
                type: 'Bare Metal',
            });
        });

        return rows;
    }
}

// Export a singleton instance
export const vultrScraper = new VultrScraper();

