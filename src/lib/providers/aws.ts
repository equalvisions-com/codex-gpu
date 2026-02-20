import crypto from 'crypto';
import type { AWSPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';
import { logger } from "@/lib/logger";

// AWS Bulk Price List for us-east-1 region
const PRICE_LIST_URL = 'https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/us-east-1/index.json';
const SOURCE_URL = 'https://aws.amazon.com/ec2/pricing/on-demand/';

// GPU instance family to GPU model mapping
const GPU_FAMILY_MAP: Record<string, { model: string; vramPerGpu: number }> = {
    // Blackwell series
    'p6-b200': { model: 'NVIDIA B200', vramPerGpu: 192 },
    'p6-b300': { model: 'NVIDIA B300', vramPerGpu: 288 },
    // Hopper series  
    'p5en': { model: 'NVIDIA H200', vramPerGpu: 141 },
    'p5e': { model: 'NVIDIA H200', vramPerGpu: 141 },
    'p5': { model: 'NVIDIA H100', vramPerGpu: 80 },
    // Ampere series (VRAM in separate column, not in model name)
    'p4d': { model: 'NVIDIA A100', vramPerGpu: 40 },
    'p4de': { model: 'NVIDIA A100', vramPerGpu: 80 },
    // Ada Lovelace series
    'g6e': { model: 'NVIDIA L40S', vramPerGpu: 48 },
    'g6': { model: 'NVIDIA L4', vramPerGpu: 24 },
    // Ampere inference
    'g5': { model: 'NVIDIA A10G', vramPerGpu: 24 },
    // Turing series
    'g4dn': { model: 'NVIDIA Tesla T4', vramPerGpu: 16 },
    'g4ad': { model: 'AMD Radeon Pro V520', vramPerGpu: 8 },
    // Graviton with T4
    'g5g': { model: 'NVIDIA Tesla T4G', vramPerGpu: 16 },
};

interface AWSProduct {
    sku: string;
    productFamily: string;
    attributes: {
        instanceType: string;
        vcpu: string;
        memory: string;
        gpu?: string;
        gpuMemory?: string;
        operatingSystem: string;
        tenancy: string;
        capacitystatus: string;
        preInstalledSw: string;
    };
}

interface AWSTerms {
    OnDemand: Record<string, Record<string, {
        priceDimensions: Record<string, {
            unit: string;
            pricePerUnit: { USD: string };
        }>;
    }>>;
}

interface AWSPriceList {
    products: Record<string, AWSProduct>;
    terms: AWSTerms;
}

class AWSScraper implements ProviderScraper {
    name = 'aws';
    url = SOURCE_URL;
    scrapeIntervalMinutes = 1440; // Daily
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        try {
            logger.info('[AWSScraper] Fetching AWS bulk price list for us-east-1...');

            const response = await fetch(PRICE_LIST_URL, {
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch AWS price list: ${response.status} ${response.statusText}`);
            }

            const priceList: AWSPriceList = await response.json();
            const sourceHash = crypto.createHash('sha256')
                .update(JSON.stringify(Object.keys(priceList.products).length))
                .digest('hex');
            const observedAt = new Date().toISOString();

            const rows = this.parseProducts(priceList, observedAt);

            // Debug: Log all parsed instances for verification
            logger.info(`[AWSScraper] Parsed ${rows.length} GPU instance pricing rows:`);
            const byModel: Record<string, string[]> = {};
            for (const row of rows) {
                if (!byModel[row.gpu_model]) byModel[row.gpu_model] = [];
                byModel[row.gpu_model].push(`${row.instance_id} (${row.gpu_count}x GPU, $${row.price_hour_usd.toFixed(2)}/hr)`);
            }
            for (const [model, instances] of Object.entries(byModel).sort()) {
                logger.info(`  ${model}: ${instances.length} instances`);
                for (const inst of instances.sort()) {
                    logger.info(`    - ${inst}`);
                }
            }

            return {
                provider: 'aws',
                rows,
                observedAt,
                sourceHash,
            };
        } catch (error) {
            throw new Error(`AWS scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private parseProducts(priceList: AWSPriceList, observedAt: string): AWSPriceRow[] {
        // Phase 1: Collect valid candidates per GPU config (lowest price per config like Azure)
        // Key = gpu_model|gpu_count|vcpus|ram
        const bestByConfig = new Map<string, {
            product: AWSProduct;
            sku: string;
            price: number;
            gpuInfo: { model: string; count: number; vramGb: number };
            vcpus: number | undefined;
            systemRamGb: number | undefined;
        }>();

        for (const [sku, product] of Object.entries(priceList.products)) {
            // Skip non-Compute instances
            if (product.productFamily !== 'Compute Instance') continue;

            const attrs = product.attributes;

            // Only Linux, Shared tenancy, Used capacity, no pre-installed software
            if (attrs.operatingSystem !== 'Linux') continue;
            if (attrs.tenancy !== 'Shared') continue;
            if (attrs.capacitystatus !== 'Used') continue;
            if (attrs.preInstalledSw !== 'NA') continue;

            const instanceType = attrs.instanceType;
            if (!instanceType) continue;

            // Check if this is a GPU instance (read GPU count directly from AWS JSON)
            const gpuCount = parseInt(attrs.gpu || '0', 10);
            if (gpuCount === 0) continue; // Skip non-GPU instances

            const gpuInfo = this.getGpuInfo(instanceType, gpuCount, attrs.gpuMemory);
            if (!gpuInfo) continue;

            // Get On-Demand price with unit validation
            const price = this.getOnDemandPrice(priceList.terms, sku);
            if (price === null) continue;

            // Parse vCPU and memory
            const vcpus = parseInt(attrs.vcpu, 10) || undefined;
            const memoryMatch = attrs.memory?.match(/^([\d.]+)/);
            const systemRamGb = memoryMatch ? parseFloat(memoryMatch[1]) : undefined;

            // Build config key WITHOUT price for lowest-price selection
            const configKey = `${gpuInfo.model}|${gpuInfo.count}|${vcpus ?? ''}|${systemRamGb ?? ''}`;

            // Keep only the lowest price for each config
            const existing = bestByConfig.get(configKey);
            if (!existing || price < existing.price) {
                bestByConfig.set(configKey, {
                    product,
                    sku,
                    price,
                    gpuInfo,
                    vcpus,
                    systemRamGb,
                });
            }
        }

        // Phase 2: Build rows from best (lowest price) candidates
        const rows: AWSPriceRow[] = [];

        for (const { product, sku, price, gpuInfo, vcpus, systemRamGb } of bestByConfig.values()) {
            const row: AWSPriceRow = {
                provider: 'aws',
                source_url: SOURCE_URL,
                observed_at: observedAt,
                instance_id: product.attributes.instanceType,
                sku: sku,
                gpu_model: gpuInfo.model,
                gpu_count: gpuInfo.count,
                vram_gb: gpuInfo.vramGb,
                vcpus,
                system_ram_gb: systemRamGb,
                price_unit: 'instance_hour',
                price_hour_usd: price,
                raw_cost: `$${price.toFixed(2)}/hr`,
                class: 'GPU',
                type: 'Virtual Machine',
            };

            rows.push(row);
        }

        // Sort by instance type for consistency
        rows.sort((a, b) => a.instance_id.localeCompare(b.instance_id));

        return rows;
    }

    private getGpuInfo(instanceType: string, gpuCount: number, gpuMemory?: string): { model: string; count: number; vramGb: number } | null {
        // Parse instance type: e.g., "p5.48xlarge" -> family="p5", size="48xlarge"
        const match = instanceType.match(/^([a-z0-9-]+)\.(.+)$/);
        if (!match) return null;

        const [, family] = match;

        // Check if family is in our GPU map
        const gpuSpec = GPU_FAMILY_MAP[family];
        if (!gpuSpec) return null;

        // Always use our hardcoded vramPerGpu * gpuCount for total VRAM.
        // AWS gpuMemory field is inconsistent: per-GPU for some families (H200),
        // total for others (B200), so we rely on our known-correct spec map.
        const vramGb = gpuSpec.vramPerGpu * gpuCount;

        return {
            model: gpuSpec.model,
            count: gpuCount,
            vramGb,
        };
    }

    private getOnDemandPrice(terms: AWSTerms, sku: string): number | null {
        const skuTerms = terms.OnDemand?.[sku];
        if (!skuTerms) return null;

        // Get the first (usually only) term
        const termKey = Object.keys(skuTerms)[0];
        if (!termKey) return null;

        const term = skuTerms[termKey];
        const priceDimensions = term.priceDimensions;
        if (!priceDimensions) return null;

        // Find the hourly price dimension (prefer unit === 'Hrs')
        let priceData: { unit: string; pricePerUnit: { USD: string } } | undefined;
        for (const dimension of Object.values(priceDimensions)) {
            if (dimension.unit === 'Hrs') {
                priceData = dimension;
                break;
            }
        }
        // Fallback to first dimension if no Hrs found
        if (!priceData) {
            const priceKey = Object.keys(priceDimensions)[0];
            if (!priceKey) return null;
            priceData = priceDimensions[priceKey];
        }

        const priceUsd = priceData?.pricePerUnit?.USD;
        if (!priceUsd || priceUsd === '0.0000000000') return null;

        return parseFloat(priceUsd);
    }
}

export const awsScraper = new AWSScraper();
