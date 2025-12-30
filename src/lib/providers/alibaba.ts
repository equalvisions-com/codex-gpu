import crypto from 'crypto';
import type { AlibabaPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';

const REGION_ID = 'us-east-1';
const ECS_ENDPOINT = `https://ecs.${REGION_ID}.aliyuncs.com/`;
const SOURCE_URL = 'https://www.alibabacloud.com/product/ecs';

// API response types
interface InstanceType {
    InstanceTypeId: string;
    InstanceTypeFamily: string;
    CpuCoreCount: number;
    MemorySize: number;
    GPUAmount: number;
    GPUSpec: string;
    GPUMemorySize: number;
    InstanceCategory?: string;
}

interface DescribeInstanceTypesResponse {
    InstanceTypes: { InstanceType: InstanceType[] };
    NextToken?: string;
}

interface AvailableZone {
    ZoneId: string;
    Status: string;
    StatusCategory?: string;
}

interface DescribeAvailableResourceResponse {
    AvailableZones?: { AvailableZone: AvailableZone[] };
}

interface DescribePriceResponse {
    PriceInfo?: {
        Price: {
            TradePrice: number;
            OriginalPrice: number;
            Currency: string;
        };
    };
}

class AlibabaScraper implements ProviderScraper {
    name = 'alibaba';
    url = SOURCE_URL;
    scrapeIntervalMinutes = 1440; // Daily
    enabled = true;

    private accessKeyId: string;
    private accessKeySecret: string;

    constructor() {
        this.accessKeyId = process.env.ALIBABA_ID || '';
        this.accessKeySecret = process.env.ALIBABA_SECRET || '';
    }

    async scrape(): Promise<ProviderResult> {
        if (!this.accessKeyId || !this.accessKeySecret) {
            throw new Error('ALIBABA_ID and ALIBABA_SECRET environment variables are required');
        }

        try {
            console.log('[AlibabaScraper] Starting Alibaba Cloud GPU pricing scrape...');
            const observedAt = new Date().toISOString();

            // Step 1: Get all GPU instance types
            console.log('[AlibabaScraper] Step 1: Fetching GPU instance types...');
            const instanceTypes = await this.getGpuInstanceTypes();
            console.log(`[AlibabaScraper] Found ${instanceTypes.length} GPU instance types`);

            // Step 2: Check availability for each type
            console.log('[AlibabaScraper] Step 2: Checking availability...');
            const availableTypes = await this.filterAvailableTypes(instanceTypes);
            console.log(`[AlibabaScraper] ${availableTypes.length} types available in ${REGION_ID}`);

            // Step 3: Get pricing for each available type
            console.log('[AlibabaScraper] Step 3: Fetching prices...');
            const rows = await this.getPricesForTypes(availableTypes, observedAt);
            console.log(`[AlibabaScraper] Scraped ${rows.length} GPU instances with pricing`);

            return {
                provider: 'alibaba',
                rows,
                observedAt,
                sourceHash: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
            };
        } catch (error) {
            throw new Error(`Alibaba scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async getGpuInstanceTypes(): Promise<InstanceType[]> {
        const allTypes: InstanceType[] = [];
        let nextToken: string | undefined;

        do {
            const params: Record<string, string> = {
                Action: 'DescribeInstanceTypes',
                RegionId: REGION_ID,
                MinimumGPUAmount: '1',
                MaxResults: '100',
            };
            if (nextToken) {
                params.NextToken = nextToken;
            }

            const response = await this.callApi<DescribeInstanceTypesResponse>(params);
            const types = response.InstanceTypes?.InstanceType || [];
            allTypes.push(...types);
            nextToken = response.NextToken;

            // Small delay to avoid rate limiting
            if (nextToken) {
                await this.delay(200);
            }
        } while (nextToken);

        // Filter out fractional GPU configs (vGPU slices like "NVIDIA A10*1/6")
        const fullGpuTypes = allTypes.filter(t => {
            const spec = t.GPUSpec || '';
            // Exclude if spec contains fraction pattern like *1/6, *1/12, etc.
            return !spec.includes('/');
        });

        return fullGpuTypes;
    }

    private async filterAvailableTypes(types: InstanceType[]): Promise<InstanceType[]> {
        const available: InstanceType[] = [];
        const batchSize = 10;

        for (let i = 0; i < types.length; i += batchSize) {
            const batch = types.slice(i, i + batchSize);
            const results = await Promise.allSettled(
                batch.map(type => this.checkAvailability(type))
            );

            for (let j = 0; j < results.length; j++) {
                const result = results[j];
                if (result.status === 'fulfilled' && result.value) {
                    available.push(batch[j]);
                }
            }

            // Delay between batches
            if (i + batchSize < types.length) {
                await this.delay(500);
            }
        }

        return available;
    }

    private async checkAvailability(type: InstanceType): Promise<boolean> {
        try {
            const params: Record<string, string> = {
                Action: 'DescribeAvailableResource',
                RegionId: REGION_ID,
                ResourceType: 'instance',
                DestinationResource: 'Zone',
                NetworkCategory: 'vpc',
                IoOptimized: 'optimized',
                InstanceType: type.InstanceTypeId,
            };

            const response = await this.callApi<DescribeAvailableResourceResponse>(params);
            const zones = response.AvailableZones?.AvailableZone || [];

            // Check if any zone has Available + WithStock
            const hasStock = zones.some(zone =>
                zone.Status === 'Available' &&
                (zone.StatusCategory === 'WithStock' || !zone.StatusCategory)
            );

            return hasStock;
        } catch {
            // HTTP 400/404 = not sellable, continue
            return false;
        }
    }

    private async getPricesForTypes(types: InstanceType[], observedAt: string): Promise<AlibabaPriceRow[]> {
        const rows: AlibabaPriceRow[] = [];
        const batchSize = 5;

        for (let i = 0; i < types.length; i += batchSize) {
            const batch = types.slice(i, i + batchSize);
            const results = await Promise.allSettled(
                batch.map(type => this.getPriceForType(type, observedAt))
            );

            for (const result of results) {
                if (result.status === 'fulfilled' && result.value) {
                    rows.push(result.value);
                }
            }

            // Delay between batches
            if (i + batchSize < types.length) {
                await this.delay(500);
            }
        }

        return rows;
    }

    private async getPriceForType(type: InstanceType, observedAt: string): Promise<AlibabaPriceRow | null> {
        try {
            const params: Record<string, string> = {
                Action: 'DescribePrice',
                RegionId: REGION_ID,
                ResourceType: 'instance',
                InstanceType: type.InstanceTypeId,
                InstanceNetworkType: 'vpc',
                InternetMaxBandwidthOut: '0',
                PriceUnit: 'Hour',
            };

            const response = await this.callApi<DescribePriceResponse>(params);
            const priceInfo = response.PriceInfo?.Price;

            if (!priceInfo) {
                return null;
            }

            return {
                provider: 'alibaba',
                source_url: SOURCE_URL,
                observed_at: observedAt,
                instance_id: type.InstanceTypeId,
                instance_family: type.InstanceTypeFamily,
                gpu_model: type.GPUSpec || 'Unknown',
                gpu_count: type.GPUAmount,
                vram_gb: type.GPUMemorySize || 0,
                vcpus: type.CpuCoreCount,
                system_ram_gb: type.MemorySize,
                price_unit: 'instance_hour',
                price_hour_usd: priceInfo.TradePrice,
                currency: priceInfo.Currency,
                class: 'GPU',
                type: this.classifyInstanceType(type),
            };
        } catch {
            // Price errors -> mark null, continue
            return null;
        }
    }

    private classifyInstanceType(type: InstanceType): 'Virtual Machine' | 'Bare Metal' | 'vGPU' {
        const family = type.InstanceTypeFamily || '';
        const id = type.InstanceTypeId || '';

        // Bare Metal: family starts with ecs.ebm
        if (family.startsWith('ecs.ebm')) {
            return 'Bare Metal';
        }

        // vGPU: -vws- in ID or vgn/sgn in family
        if (id.includes('-vws-') || family.includes('vgn') || family.includes('sgn')) {
            return 'vGPU';
        }

        // Everything else with GPU is VM
        return 'Virtual Machine';
    }

    private async callApi<T>(params: Record<string, string>): Promise<T> {
        const commonParams: Record<string, string> = {
            Format: 'JSON',
            Version: '2014-05-26',
            AccessKeyId: this.accessKeyId,
            SignatureMethod: 'HMAC-SHA1',
            Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            SignatureVersion: '1.0',
            SignatureNonce: crypto.randomUUID(),
        };

        const allParams = { ...commonParams, ...params };
        const signature = this.signRequest(allParams);
        allParams.Signature = signature;

        const queryString = Object.entries(allParams)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');

        const response = await fetch(`${ECS_ENDPOINT}?${queryString}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`);
        }

        return response.json() as Promise<T>;
    }

    private signRequest(params: Record<string, string>): string {
        // Sort parameters
        const sortedKeys = Object.keys(params).sort();
        const canonicalizedQuery = sortedKeys
            .map(k => `${this.percentEncode(k)}=${this.percentEncode(params[k])}`)
            .join('&');

        // Create string to sign
        const stringToSign = `GET&${this.percentEncode('/')}&${this.percentEncode(canonicalizedQuery)}`;

        // Sign with HMAC-SHA1
        const hmac = crypto.createHmac('sha1', `${this.accessKeySecret}&`);
        hmac.update(stringToSign);
        return hmac.digest('base64');
    }

    private percentEncode(str: string): string {
        return encodeURIComponent(str)
            .replace(/\+/g, '%20')
            .replace(/\*/g, '%2A')
            .replace(/%7E/g, '~');
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const alibabaScraper = new AlibabaScraper();
