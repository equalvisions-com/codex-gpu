import crypto from 'crypto';
import type { AzurePriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';
import { logger } from "@/lib/logger";

// Azure Retail Prices API for eastus region
const API_URL = 'https://prices.azure.com/api/retail/prices';
const SOURCE_URL = 'https://azure.microsoft.com/en-us/pricing/details/virtual-machines/linux/';

// GPU VM series to GPU model mapping
// Azure uses series naming like NCasT4, NDsrH100, NVadsA10
const GPU_SERIES_MAP: Record<string, { model: string; vramPerGpu: number }> = {
    // NVIDIA Blackwell
    'GB200': { model: 'NVIDIA GB200', vramPerGpu: 192 },
    // NVIDIA Hopper - NCads H100 v5 uses H100 NVL (94GB), ND H100 v5 uses standard H100 (80GB)
    'H100_NVL': { model: 'NVIDIA H100 NVL', vramPerGpu: 94 },  // For NCads H100 v5
    'H100': { model: 'NVIDIA H100', vramPerGpu: 80 },           // For ND H100 v5
    'H200': { model: 'NVIDIA H200', vramPerGpu: 141 },
    // NVIDIA Ampere
    'A100': { model: 'NVIDIA A100', vramPerGpu: 80 },
    'A10': { model: 'NVIDIA A10', vramPerGpu: 24 },
    // NVIDIA Turing
    'T4': { model: 'NVIDIA Tesla T4', vramPerGpu: 16 },
    // NVIDIA Volta
    'V100': { model: 'NVIDIA Tesla V100', vramPerGpu: 16 },
    // NVIDIA Tesla (older)
    'M60': { model: 'NVIDIA Tesla M60', vramPerGpu: 8 },
    'P40': { model: 'NVIDIA Tesla P40', vramPerGpu: 24 },
    'K80': { model: 'NVIDIA Tesla K80', vramPerGpu: 12 },
    // AMD
    'MI25': { model: 'AMD Radeon Instinct MI25', vramPerGpu: 16 },
    'V710': { model: 'AMD Radeon V710', vramPerGpu: 28 },  // CORRECTED: 28GB per MS docs
};

// GPU counts by SKU pattern (derived from Azure documentation)
const GPU_COUNTS: Record<string, number> = {
    // NC series - T4
    'NC4as_T4_v3': 1, 'NC8as_T4_v3': 1, 'NC16as_T4_v3': 1, 'NC64as_T4_v3': 4,
    // NC series - A100
    'NC24ads_A100_v4': 1, 'NC48ads_A100_v4': 2, 'NC96ads_A100_v4': 4,
    // NC series - H100
    'NC40ads_H100_v5': 1, 'NC80adis_H100_v5': 2,
    // ND series - A100
    'ND96asr_A100_v4': 8, 'ND96asr_v4': 8, 'ND96ams_A100_v4': 8, 'ND96amsr_A100_v4': 8,
    // ND series - H100
    'ND96is_H100_v5': 8, 'ND96isr_H100_v5': 8, 'ND96is_noIB_H100_v5': 8,
    'ND96is_flex_H100_v5': 8, 'ND96isrf_H100_v5': 8,
    // ND series - GB200 (CORRECTED: 4 GPUs, not 8 - per Azure docs)
    'ND128isr_NDR_GB200_v6': 4,
    // ND series - older
    'ND40s_v2': 8, 'ND40rs_v2': 8,
    // NCS series - V100
    'NC6s_v3': 1, 'NC12s_v3': 2, 'NC24s_v3': 4, 'NC24rs_v3': 4,
    // NV series - A10 (CORRECTED: fractional GPUs - only NV36+ have >= 1 GPU)
    'NV6ads_A10_v5': 0.166, 'NV12ads_A10_v5': 0.33, 'NV18ads_A10_v5': 0.5,
    'NV36ads_A10_v5': 1, 'NV36adms_A10_v5': 1, 'NV72ads_A10_v5': 2,
    // NV series - V710 (AMD) - CORRECTED: fractional GPUs - only NV24+ have >= 1 GPU
    'NV4ads_V710_v5': 0.166, 'NV8ads_V710_v5': 0.33, 'NV12ads_V710_v5': 0.5,
    'NV24ads_V710_v5': 1, 'NV28adms_V710_v5': 1,
    // NV series - MI25 (AMD) - CORRECTED: fractional GPUs - all < 1 GPU (1/8 to 1/2)
    'NV4as_v4': 0.125, 'NV8as_v4': 0.25, 'NV16as_v4': 0.5, 'NV32as_v4': 1,
    // NVS v3 - M60
    'NV12s_v3': 1, 'NV24s_v3': 2, 'NV48s_v3': 4,
    // Promo series (K80) - full GPUs
    'NC6_Promo': 1, 'NC12_Promo': 2, 'NC24_Promo': 4, 'NC24r_Promo': 4,
    'NV6_Promo': 0.5, 'NV12_Promo': 1, 'NV24_Promo': 2,
};

// System RAM in GB by SKU (from Azure documentation)
const SYSTEM_RAM_GB: Record<string, number> = {
    // ND H100 v5 series - 1900 GB (CORRECTED per Azure docs - not 900)
    'ND96is_H100_v5': 1900, 'ND96isr_H100_v5': 1900,
    'ND96is_noIB_H100_v5': 1900, 'ND96is_flex_H100_v5': 1900, 'ND96isrf_H100_v5': 1900,
    // ND GB200 v6 - 900 GB (CORRECTED per Azure docs - not 1792)
    'ND128isr_NDR_GB200_v6': 900,
    // NC A100 v4 series
    'NC24ads_A100_v4': 220, 'NC48ads_A100_v4': 440, 'NC96ads_A100_v4': 880,
    // NC H100 v5 series
    'NC40ads_H100_v5': 320, 'NC80adis_H100_v5': 640,
    // NC T4 v3 series
    'NC4as_T4_v3': 28, 'NC8as_T4_v3': 56, 'NC16as_T4_v3': 110, 'NC64as_T4_v3': 440,
    // ND A100 v4 series
    'ND96asr_A100_v4': 900, 'ND96asr_v4': 900, 'ND96ams_A100_v4': 1900, 'ND96amsr_A100_v4': 1900,
    // NCS v3 - V100 series
    'NC6s_v3': 112, 'NC12s_v3': 224, 'NC24s_v3': 448, 'NC24rs_v3': 448,
    // NVS v3 - M60
    'NV12s_v3': 112, 'NV24s_v3': 224, 'NV48s_v3': 448,
    // NV A10 v5 series - CORRECTED per Azure docs (55/110/220/440/880/880)
    'NV6ads_A10_v5': 55, 'NV12ads_A10_v5': 110, 'NV18ads_A10_v5': 220,
    'NV36ads_A10_v5': 440, 'NV36adms_A10_v5': 880, 'NV72ads_A10_v5': 880,
    // NV V710 v5 series - CORRECTED per Azure docs (16/32/64/128/160)
    'NV4ads_V710_v5': 16, 'NV8ads_V710_v5': 32, 'NV12ads_V710_v5': 64,
    'NV24ads_V710_v5': 128, 'NV28adms_V710_v5': 160,
    // NV as v4 - AMD MI25
    'NV4as_v4': 14, 'NV8as_v4': 28, 'NV16as_v4': 56, 'NV32as_v4': 112,
    // ND v2 series - V100
    'ND40s_v2': 672, 'ND40rs_v2': 672,
    // Promo series (K80/M60 - older)
    'NC6_Promo': 56, 'NC12_Promo': 112, 'NC24_Promo': 224, 'NC24r_Promo': 224,
    'NV6_Promo': 56, 'NV12_Promo': 112, 'NV24_Promo': 224,
};

interface AzurePriceItem {
    currencyCode: string;
    retailPrice: number;
    unitOfMeasure: string;
    armRegionName: string;
    productName: string;
    skuName: string;
    armSkuName: string;
    meterName: string;
    serviceName: string;
    type: string;
    effectiveStartDate: string;
    skuId: string;
    productId: string;
}

interface AzurePriceResponse {
    Items: AzurePriceItem[];
    NextPageLink: string | null;
}

class AzureScraper implements ProviderScraper {
    name = 'azure';
    url = SOURCE_URL;
    scrapeIntervalMinutes = 1440; // Daily
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        try {
            logger.info('[AzureScraper] Fetching Azure retail prices for eastus...');

            const allItems: AzurePriceItem[] = [];

            // Server-side filtering to reduce data fetched (from 6000+ to ~264 items)
            // Note: Azure API supports contains() but NOT 'not(contains(...))' syntax
            // Filter: GPU series by armSkuName, Windows/Spot filtering done client-side
            const filter = [
                "armRegionName eq 'eastus'",
                "serviceName eq 'Virtual Machines'",
                "priceType eq 'Consumption'",
                // GPU series only (armSkuName filtering works!)
                "(contains(armSkuName,'Standard_NC') or contains(armSkuName,'Standard_ND') or contains(armSkuName,'Standard_NV'))",
            ].join(' and ');

            // meterRegion='primary' reduces duplicates from multi-region meters
            let url: string | null = `${API_URL}?api-version=2023-01-01-preview&meterRegion='primary'&currencyCode=USD&$filter=${encodeURIComponent(filter)}`;
            let pageCount = 0;

            // Paginate through all results (raised cap from 20 to 100)
            while (url && pageCount < 100) {
                pageCount++;
                const response = await fetch(url, {
                    headers: { 'Accept': 'application/json' },
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch Azure prices: ${response.status} ${response.statusText}`);
                }

                const data: AzurePriceResponse = await response.json();
                allItems.push(...data.Items);
                url = data.NextPageLink;
            }

            // Warn if we hit the page cap (results may be truncated)
            if (pageCount >= 100 && url) {
                logger.warn('[AzureScraper] Hit 100-page cap with more pages available; results may be truncated');
            }

            logger.info(`[AzureScraper] Fetched ${allItems.length} items across ${pageCount} pages`);

            const sourceHash = crypto.createHash('sha256')
                .update(JSON.stringify(allItems.length))
                .digest('hex');
            const observedAt = new Date().toISOString();

            const rows = this.parseItems(allItems, observedAt);

            logger.info(`[AzureScraper] Parsed ${rows.length} GPU VM pricing rows`);

            return {
                provider: 'azure',
                rows,
                observedAt,
                sourceHash,
            };
        } catch (error) {
            throw new Error(`Azure scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private parseItems(items: AzurePriceItem[], observedAt: string): AzurePriceRow[] {
        // Phase 1: Collect valid candidates per GPU config
        // Key = gpu_model|gpu_count|vcpus|ram (without price)
        // We keep the lowest price for each config
        const bestByConfig = new Map<string, { item: AzurePriceItem; configKey: string; gpuInfo: { model: string; count: number; vramPerGpu: number }; vcpus: number | undefined; systemRamGb: number | undefined }>();

        for (const item of items) {
            const sku = item.armSkuName;
            if (!sku) continue;

            // Only process Standard GPU SKUs (NC, ND, NV prefixes)
            if (!sku.startsWith('Standard_NC') && !sku.startsWith('Standard_ND') && !sku.startsWith('Standard_NV')) {
                continue;
            }

            // Skip Windows (we want Linux only)
            if (item.productName.includes('Windows')) continue;

            // Skip Spot and Low Priority (check both skuName and meterName)
            const spotCheck = `${item.skuName ?? ''} ${item.meterName ?? ''}`.toLowerCase();
            if (spotCheck.includes('spot') || spotCheck.includes('low priority')) continue;

            // Flexible unitOfMeasure check (case-insensitive, allow variations)
            const uom = (item.unitOfMeasure || '').toLowerCase();
            if (!(uom === '1 hour' || uom === 'hour')) continue;

            // Get GPU info
            const gpuInfo = this.getGpuInfo(sku, item.productName);
            if (!gpuInfo) continue;

            // Skip fractional GPU SKUs - we only want gpu_count >= 1
            if (gpuInfo.count < 1) continue;

            // Skip zero or invalid prices
            if (!item.retailPrice || item.retailPrice <= 0) continue;

            // Build config key WITHOUT price for lowest-price selection
            const vcpus = this.parseVcpuFromSku(sku);
            const skuName = sku.replace('Standard_', '');
            const systemRamGb = SYSTEM_RAM_GB[skuName];
            const configKey = `${gpuInfo.model}|${gpuInfo.count}|${vcpus ?? ''}|${systemRamGb ?? ''}`;

            // Keep only the lowest price for each config
            const existing = bestByConfig.get(configKey);
            if (!existing || item.retailPrice < existing.item.retailPrice) {
                bestByConfig.set(configKey, { item, configKey, gpuInfo, vcpus, systemRamGb });
            }
        }

        // Phase 2: Build rows from best (lowest price) candidates
        const rows: AzurePriceRow[] = [];

        for (const { item, gpuInfo, vcpus, systemRamGb } of bestByConfig.values()) {
            const row: AzurePriceRow = {
                provider: 'azure',
                source_url: SOURCE_URL,
                observed_at: observedAt,
                instance_id: item.armSkuName,
                sku: item.skuId,
                gpu_model: gpuInfo.model,
                gpu_count: gpuInfo.count,
                vram_gb: gpuInfo.vramPerGpu * gpuInfo.count,
                vcpus,
                system_ram_gb: systemRamGb,
                price_unit: 'instance_hour',
                price_hour_usd: item.retailPrice,
                raw_cost: `$${item.retailPrice.toFixed(2)}/hr`,
                class: 'GPU',
                type: 'Virtual Machine',
            };

            rows.push(row);
        }

        // Sort by SKU for consistency
        rows.sort((a, b) => a.instance_id.localeCompare(b.instance_id));

        return rows;
    }

    private getGpuInfo(sku: string, productName: string): { model: string; count: number; vramPerGpu: number } | null {
        // Remove Standard_ prefix
        const skuName = sku.replace('Standard_', '');

        // Try to find GPU count from explicit mapping
        let gpuCount = GPU_COUNTS[skuName];
        if (gpuCount === undefined) {
            // Fallback: try without version suffix
            const baseSkuMatch = skuName.match(/^([A-Z]+\d+[a-z_]+)/i);
            if (baseSkuMatch) {
                gpuCount = GPU_COUNTS[baseSkuMatch[1]] || 1;
            } else {
                gpuCount = 1;
            }
        }

        // Determine GPU model from product name or SKU
        let gpuSpec: { model: string; vramPerGpu: number } | undefined;

        // SPECIAL CASES FIRST (before generic scan to avoid misclassification)
        // NCads H100 v5 uses H100 NVL (94GB) - only known SKUs: NC40ads_H100_v5, NC80adis_H100_v5
        if (/NC(40ads|80adis)_H100_v5/i.test(sku) || /NCads.*H100/i.test(productName)) {
            gpuSpec = GPU_SERIES_MAP['H100_NVL'];
        }

        // Generic scan for known GPU identifiers (if not already matched)
        if (!gpuSpec) {
            // IMPORTANT: Sort keys by length (longest first) to avoid substring collisions
            // e.g., "A10" matching "A100", or "H100" matching "H100_NVL"
            const sortedKeys = Object.keys(GPU_SERIES_MAP).sort((a, b) => b.length - a.length);
            for (const key of sortedKeys) {
                if (sku.includes(key) || productName.includes(key)) {
                    gpuSpec = GPU_SERIES_MAP[key];
                    break;
                }
            }
        }

        // Additional pattern matching for series
        if (!gpuSpec) {
            if (productName.includes('NCasT4') || sku.includes('T4')) {
                gpuSpec = GPU_SERIES_MAP['T4'];
            } else if (productName.includes('NCSv3') || sku.includes('NC') && sku.includes('s_v3')) {
                gpuSpec = GPU_SERIES_MAP['V100'];
            } else if (productName.includes('NVSv3') || sku.includes('NV') && sku.includes('s_v3')) {
                gpuSpec = GPU_SERIES_MAP['M60'];
            } else if (productName.includes('NVasv4') || sku.includes('NV') && sku.includes('as_v4')) {
                // Skip AMD MI25 - old GPU not worth tracking
                return null;
            } else if (productName.includes('NC Promo') || sku.includes('NC') && sku.includes('Promo')) {
                // K80 promo series - old but still listed
                return { model: 'NVIDIA Tesla K80', count: gpuCount, vramPerGpu: 12 };
            } else if (productName.includes('NV Promo') || sku.includes('NV') && sku.includes('Promo')) {
                gpuSpec = GPU_SERIES_MAP['M60'];
            } else if (productName.includes('NDSv2') || sku.includes('ND40s_v2')) {
                gpuSpec = GPU_SERIES_MAP['V100'];
            } else if (productName.includes('NDrSv2') || sku.includes('ND40rs_v2')) {
                gpuSpec = GPU_SERIES_MAP['V100'];
            }
        }

        if (!gpuSpec) {
            logger.info(`[AzureScraper] Unknown GPU for SKU: ${sku}, productName: ${productName}`);
            return null;
        }

        return {
            model: gpuSpec.model,
            count: gpuCount,
            vramPerGpu: gpuSpec.vramPerGpu,
        };
    }

    private parseVcpuFromSku(sku: string): number | undefined {
        // Remove Standard_ prefix
        const skuName = sku.replace('Standard_', '');

        // Azure SKU pattern: NC96, ND96, NV36, NC4, etc.
        // The number typically represents vCPU count
        const match = skuName.match(/^(NC|ND|NV)(\d+)/i);
        if (match) {
            const vcpuCount = parseInt(match[2], 10);
            if (!isNaN(vcpuCount) && vcpuCount > 0) {
                return vcpuCount;
            }
        }

        return undefined;
    }
}

export const azureScraper = new AzureScraper();
