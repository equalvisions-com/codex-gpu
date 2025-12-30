import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { CivoPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';

const PRICING_URL = 'https://www.civo.com/pricing';
const SOURCE_URL = 'https://www.civo.com/pricing#nvidia-gpus';

class CivoScraper implements ProviderScraper {
    name = 'civo';
    url = PRICING_URL;
    scrapeIntervalMinutes = 1440; // Daily
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        try {
            console.log('[CivoScraper] Fetching Civo pricing page...');

            const response = await fetch(PRICING_URL, {
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
                throw new Error(`Failed to fetch Civo pricing page: ${response.status}`);
            }

            const html = await response.text();
            const sourceHash = crypto.createHash('sha256').update(html).digest('hex');
            const observedAt = new Date().toISOString();

            const rows = this.parsePricingPage(html, observedAt);

            console.log(`[CivoScraper] Parsed ${rows.length} GPU instance pricing rows`);

            return {
                provider: 'civo',
                rows,
                observedAt,
                sourceHash,
            };
        } catch (error) {
            throw new Error(`Civo scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private parsePricingPage(html: string, observedAt: string): CivoPriceRow[] {
        const rows: CivoPriceRow[] = [];
        const seenInstances = new Set<string>();
        const $ = cheerio.load(html);

        // DOM Structure:
        // <div class="pricing-section-description">
        //   <h4>NVIDIA H100 SXM GPU pricing</h4>
        // </div>
        // <div class="pricing-table-wrapper">
        //   <table>...</table>
        // </div>

        // Find all pricing section headers
        $('.pricing-section-description').each((_, section) => {
            const $section = $(section);
            const headerText = $section.find('h4').first().text().trim();

            // Check if this is a GPU pricing section (must have NVIDIA and pricing)
            if (!headerText.includes('NVIDIA') || !headerText.toLowerCase().includes('pricing')) {
                return;
            }

            // Dynamically extract GPU model from header
            // Format: "NVIDIA [MODEL] [VARIANT?] [VRAM?]GB GPU pricing"
            // Examples: "NVIDIA L40S 48GB GPU pricing", "NVIDIA H100 SXM GPU pricing"
            const { gpuModel, headerVramGb } = this.parseGpuModelFromHeader(headerText);
            if (!gpuModel) {
                console.log(`[CivoScraper] Could not parse GPU model from header: ${headerText}`);
                return;
            }

            // Get the next sibling which contains the table
            const $tableWrapper = $section.next('.pricing-table-wrapper');
            const $table = $tableWrapper.find('table');

            if ($table.length === 0) {
                console.log(`[CivoScraper] No table found for: ${headerText}`);
                return;
            }

            // Parse each row in the table
            $table.find('tr').each((_, row) => {
                const $row = $(row);
                const cells = $row.find('td');

                if (cells.length < 6) return; // Skip header rows

                // Parse the size description to extract GPU count and VRAM
                // Format: "Small\n1 x NVIDIA H100 - 80GB" or "1 x NVIDIA L40S - 48GB"
                const sizeText = $(cells[0]).text().trim();

                // Extract GPU count
                const gpuCountMatch = sizeText.match(/(\d+)\s*x\s*NVIDIA/i);
                if (!gpuCountMatch) return;
                const gpuCount = parseInt(gpuCountMatch[1], 10);
                if (gpuCount === 0) return;

                // Extract VRAM from row if not in header (e.g., "- 80GB")
                let vramGb = headerVramGb;
                if (vramGb === 0) {
                    const rowVramMatch = sizeText.match(/-\s*(\d+)\s*GB/i);
                    if (rowVramMatch) {
                        vramGb = parseInt(rowVramMatch[1], 10);
                    }
                }

                // Parse RAM (e.g., "96 GB" or "2.5TB")
                const ramText = $(cells[1]).text().trim();
                const ramMatch = ramText.match(/([\d.]+)\s*(GB|TB)/i);
                let systemRamGb = 0;
                if (ramMatch) {
                    systemRamGb = parseFloat(ramMatch[1]);
                    if (ramMatch[2].toLowerCase() === 'tb') {
                        systemRamGb = Math.round(systemRamGb * 1024);
                    }
                }

                // Parse vCPU (e.g., "12" or "220 cores")
                const vcpuText = $(cells[2]).text().trim();
                const vcpuMatch = vcpuText.match(/(\d+)/);
                const vcpus = vcpuMatch ? parseInt(vcpuMatch[1], 10) : 0;

                // Parse storage (e.g., "200GB NVMe")
                const storage = $(cells[3]).text().trim();

                // Parse on-demand price (column 5, 0-indexed)
                const onDemandText = $(cells[5]).text().trim();

                // Handle N/A prices (like B200 on-demand) - include with undefined price
                const isNaPrice = onDemandText.toLowerCase().includes('n/a');
                let priceHourUsd: number | undefined = undefined;

                if (!isNaPrice) {
                    const priceMatch = onDemandText.match(/\$?([\d.]+)/);
                    priceHourUsd = priceMatch ? parseFloat(priceMatch[1]) : undefined;
                }

                // Skip rows with no vCPUs (invalid data)
                if (vcpus === 0) {
                    return;
                }

                // Generate unique instance ID
                const instanceId = `civo-${gpuModel.toLowerCase().replace(/\s+/g, '-')}-${gpuCount}x`;

                // Skip duplicates
                if (seenInstances.has(instanceId)) {
                    return;
                }
                seenInstances.add(instanceId);

                rows.push({
                    provider: 'civo',
                    source_url: SOURCE_URL,
                    observed_at: observedAt,
                    instance_id: instanceId,
                    gpu_model: gpuModel,
                    gpu_count: gpuCount,
                    vram_gb: vramGb * gpuCount,
                    vcpus,
                    system_ram_gb: systemRamGb,
                    storage,
                    price_unit: 'instance_hour',
                    price_hour_usd: priceHourUsd,
                    raw_cost: onDemandText,
                    class: 'GPU',
                    type: 'Virtual Machine',
                });
            });
        });

        return rows;
    }

    /**
     * Dynamically parses GPU model and VRAM from header text.
     * No hardcoded model list - works for any new GPU Civo adds.
     * 
     * Examples:
     * - "NVIDIA L40S 48GB GPU pricing" -> { gpuModel: "NVIDIA L40S", headerVramGb: 48 }
     * - "NVIDIA H100 SXM GPU pricing" -> { gpuModel: "NVIDIA H100 SXM", headerVramGb: 0 }
     * - "NVIDIA A100 80GB GPU pricing" -> { gpuModel: "NVIDIA A100 80GB", headerVramGb: 80 }
     */
    private parseGpuModelFromHeader(headerText: string): { gpuModel: string; headerVramGb: number } {
        // Remove "GPU pricing" suffix (case insensitive)
        const withoutSuffix = headerText.replace(/\s*GPU\s*pricing\s*/i, '').trim();

        // Try to extract VRAM from the model text (e.g., "NVIDIA L40S 48GB" or "NVIDIA A100 80GB")
        // Pattern: look for number followed by GB at the end
        const vramMatch = withoutSuffix.match(/(\d+)\s*GB$/i);

        let gpuModel = withoutSuffix;
        let headerVramGb = 0;

        if (vramMatch) {
            headerVramGb = parseInt(vramMatch[1], 10);
            // Remove the VRAM part from model name for models like A100 where VRAM is part of the name
            // But keep it for display (A100 40GB vs A100 80GB are different products)
            // The model name stays as-is: "NVIDIA A100 80GB"
        }

        // Ensure model starts with NVIDIA
        if (!gpuModel.startsWith('NVIDIA')) {
            gpuModel = 'NVIDIA ' + gpuModel;
        }

        return { gpuModel, headerVramGb };
    }
}

// Export singleton instance
export const civoScraper = new CivoScraper();
