import crypto from 'crypto';
import type { VoltageParkPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';

const API_BASE_URL = 'https://cloud-api.voltagepark.com/api/v1';

class VoltageParkScraper implements ProviderScraper {
    name = 'voltagepark';
    url = 'https://www.voltagepark.com/';
    scrapeIntervalMinutes = 1440;
    enabled = true;

    async scrape(): Promise<ProviderResult> {
        const apiKey = process.env.VOLTAGE_PARK;
        if (!apiKey) {
            console.warn('[VoltageParkScraper] VOLTAGE_PARK environment variable not set, skipping');
            return {
                provider: "voltagepark",
                rows: [],
                observedAt: new Date().toISOString(),
                sourceHash: "",
            };
        }

        try {
            const [vmResponse, bmResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/virtual-machines/instant/locations`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                }),
                fetch(`${API_BASE_URL}/bare-metal/locations`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                })
            ]);

            if (!vmResponse.ok) throw new Error(`VM API failed: ${vmResponse.status}`);
            if (!bmResponse.ok) throw new Error(`BM API failed: ${bmResponse.status}`);

            const vmData = await vmResponse.json();
            const bmData = await bmResponse.json();

            const combinedData = { vmData, bmData };
            const sourceHash = crypto.createHash('sha256').update(JSON.stringify(combinedData)).digest('hex');

            const vmRows = this.parseVmLocations(vmData.results || []);
            const bmRows = this.parseBmLocations(bmData.results || []);

            const rows = [...vmRows, ...bmRows];
            console.log(`[VoltageParkScraper] Parsed ${rows.length} GPU pricing rows (${vmRows.length} VMs, ${bmRows.length} Bare Metal)`);

            return {
                provider: "voltagepark",
                rows,
                observedAt: new Date().toISOString(),
                sourceHash,
            };
        } catch (error) {
            throw new Error(`Voltage Park scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private parseVmLocations(locations: any[]): VoltageParkPriceRow[] {
        const rows: VoltageParkPriceRow[] = [];
        const observedAt = new Date().toISOString();

        for (const location of locations) {
            const region = location.id; // Using ID as region name for now if nothing else exists
            for (const preset of location.available_presets || []) {
                const { resources, compute_rate_hourly, id: presetId } = preset;
                const gpus = resources?.gpus || {};

                for (const [gpuKey, gpuInfo] of Object.entries<any>(gpus)) {
                    const gpuModel = this.normalizeGpuModel(gpuKey);
                    const gpuCount = gpuInfo.count || 1;
                    const priceHourUsd = parseFloat(compute_rate_hourly) || 0;

                    if (priceHourUsd === 0) continue;

                    rows.push({
                        provider: 'voltagepark',
                        source_url: this.url,
                        observed_at: observedAt,
                        instance_id: `${location.id}-${presetId}`,
                        gpu_model: gpuModel,
                        gpu_count: gpuCount,
                        vram_gb: this.extractVram(gpuKey),
                        vcpus: resources.vcpu_count,
                        system_ram_gb: resources.ram_gb,
                        storage: `${resources.storage_gb}GB`,
                        region: region,
                        price_unit: 'instance_hour',
                        price_hour_usd: priceHourUsd,
                        raw_cost: `$${compute_rate_hourly}/hr`,
                        class: 'GPU',
                        type: 'Virtual Machine'
                    });
                }
            }
        }
        return rows;
    }

    private parseBmLocations(locations: any[]): VoltageParkPriceRow[] {
        const rows: VoltageParkPriceRow[] = [];
        const observedAt = new Date().toISOString();

        for (const location of locations) {
            const { specs_per_node, gpu_price_ethernet, gpu_price_infiniband } = location;
            if (!specs_per_node) continue;

            const gpuModel = this.normalizeGpuModel(specs_per_node.gpu_model);
            const gpuCount = specs_per_node.gpu_count || 8;

            const pricingConfigs = [
                { price: parseFloat(gpu_price_ethernet), type: 'Ethernet' },
                { price: parseFloat(gpu_price_infiniband), type: 'Infiniband' }
            ];

            for (const config of pricingConfigs) {
                if (isNaN(config.price) || config.price === 0) continue;

                const priceHourUsd = config.price * gpuCount;

                rows.push({
                    provider: 'voltagepark',
                    source_url: this.url,
                    observed_at: observedAt,
                    instance_id: `bm-${location.id}-${config.type.toLowerCase()}`,
                    gpu_model: `${gpuModel} (${config.type})`,
                    gpu_count: gpuCount,
                    vram_gb: this.extractVram(specs_per_node.gpu_model),
                    vcpus: specs_per_node.cpu_count,
                    system_ram_gb: specs_per_node.ram_gb,
                    storage: `${specs_per_node.storage_gb}GB`,
                    region: location.id,
                    price_unit: 'instance_hour',
                    price_hour_usd: priceHourUsd,
                    raw_cost: `$${config.price}/hr per GPU (${config.type})`,
                    class: 'GPU',
                    type: 'Bare Metal'
                });
            }
        }
        return rows;
    }

    private normalizeGpuModel(model: string): string {
        // e.g., "h100-sxm5-80gb" -> "NVIDIA H100 SXM5"
        return model
            .replace(/-(\d+)gb$/i, '')
            .replace(/-/g, ' ')
            .toUpperCase()
            .replace(/^H/, 'NVIDIA H')
            .replace(/^A/, 'NVIDIA A')
            .replace(/^L/, 'NVIDIA L')
            .trim();
    }

    private extractVram(model: string): number | undefined {
        // e.g., "h100-sxm5-80gb" -> 80
        const match = model.match(/-(\d+)gb$/i);
        return match ? parseInt(match[1]) : undefined;
    }
}

export const voltageParkScraper = new VoltageParkScraper();
