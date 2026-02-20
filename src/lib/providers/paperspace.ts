import crypto from 'crypto';
import type { PaperspacePriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';

const API_URL = 'https://api.paperspace.com/trpc/machines.createFormDataV2';
const SOURCE_URL = 'https://console.paperspace.com';

// TRPC batch input for getting machine types
const TRPC_INPUT = encodeURIComponent(JSON.stringify({
    "0": { "json": null, "meta": { "values": ["undefined"] } }
}));

// GPU VRAM lookup - verified from NVIDIA specs
const GPU_VRAM_GB: Record<string, number> = {
    'Hopper H100': 80,
    'Ampere A100': 40,
    'Ampere A100 80G': 80,
    'Ampere A100 80G PCIe': 80,
    'Ampere A6000': 48,
    'Ampere A5000': 24,
    'Ampere A4000': 16,
    'Tesla V100': 16,
    'Tesla V100 32G': 32,
    'Quadro RTX5000': 16,
    'Quadro RTX4000': 8,
    'Quadro P6000': 24,
    'Quadro P5000': 16,
    'Quadro P4000': 8,
    'Quadro M4000': 8,
    'Tesla K80': 12,
    'Tesla P100': 16,
    'Tesla T4': 16,
};

// Skip patterns
const SKIP_PATTERNS = [
    'GPU+',       // M4000 legacy
    'Free-',      // Free tier instances
    'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', // CPU-only
    'p2.', 'p3.', 'c5.',   // AWS instances
    'nc4', 'nc6',           // Azure instances
    'Air', 'Standard', 'Advanced', 'Pro', // Legacy GRID
    'metal-',               // Metal instances
    'K80', 'P100', 'T4', 'GV100', 'TPU', // Legacy/special
];

interface MachineType {
    label: string;
    cpus: number;
    ram: string;
    gpu: string | null;
    metadata?: {
        'gpu-memory'?: string;
        'gpu-count'?: number;
    };
    supportsNvlink?: boolean;
    defaultUsageRates: Array<{
        description: string;
        rate: number;
        type: 'hourly' | 'monthly';
    }>;
    availability: Array<{
        machineType: string;
        region: string;
        isAvailable: boolean;
    }>;
}

interface TrpcResponse {
    result: {
        data: {
            json: {
                machineTypes: MachineType[];
            };
        };
    };
}

class PaperspaceScraper implements ProviderScraper {
    name = 'paperspace';
    url = SOURCE_URL;
    scrapeIntervalMinutes = 1440; // Daily
    enabled = true;

    private token: string;

    constructor() {
        this.token = process.env.PAPERSPACE_TOKEN || '';
    }

    async scrape(): Promise<ProviderResult> {
        if (!this.token) {
            throw new Error('PAPERSPACE_TOKEN environment variable is required');
        }

        try {
            console.log('[PaperspaceScraper] Fetching machine types...');
            const observedAt = new Date().toISOString();

            const response = await fetch(`${API_URL}?batch=1&input=${TRPC_INPUT}`, {
                method: 'GET',
                headers: {
                    'accept': 'application/json',
                    'authorization': `Bearer ${this.token}`,
                    'content-type': 'application/json',
                    'origin': 'https://console.paperspace.com',
                    'x-client': 'PS-WEB',
                },
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json() as Record<string, TrpcResponse>;
            const machineTypes = data['0']?.result?.data?.json?.machineTypes || [];

            console.log(`[PaperspaceScraper] Found ${machineTypes.length} machine types`);

            const rows: PaperspacePriceRow[] = [];

            for (const mt of machineTypes) {
                // Skip non-GPU and legacy instances
                if (!mt.gpu || mt.gpu === 'None') continue;
                if (this.shouldSkip(mt.label)) continue;

                // Get available regions
                const availableRegions = mt.availability
                    .filter(a => a.isAvailable)
                    .map(a => a.region);

                // Only include if at least one region is available
                if (availableRegions.length === 0) continue;

                // Get hourly rate
                const hourlyRate = mt.defaultUsageRates.find(r => r.type === 'hourly');
                if (!hourlyRate) continue;

                // Parse GPU count from label (e.g., "A6000x4" -> 4)
                const gpuCount = this.parseGpuCount(mt.label);

                // Get VRAM per GPU
                const vramPerGpu = GPU_VRAM_GB[mt.gpu] || 0;
                const totalVram = vramPerGpu * gpuCount;

                // Parse RAM (comes as bigint string)
                const ramGb = Math.round(parseInt(mt.ram, 10) / 1073741824);

                const row: PaperspacePriceRow = {
                    provider: 'paperspace',
                    source_url: SOURCE_URL,
                    observed_at: observedAt,
                    instance_id: mt.label,
                    gpu_model: this.normalizeGpuModel(mt.gpu),
                    gpu_count: gpuCount,
                    vram_gb: totalVram,
                    vcpus: mt.cpus,
                    system_ram_gb: ramGb,
                    price_unit: 'instance_hour',
                    price_hour_usd: hourlyRate.rate,
                    currency: 'USD',
                    regions: availableRegions,
                    class: 'GPU',
                    type: 'Virtual Machine',
                };

                rows.push(row);
            }

            console.log(`[PaperspaceScraper] Scraped ${rows.length} available GPU configurations`);

            return {
                provider: 'paperspace',
                rows,
                observedAt,
                sourceHash: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
            };
        } catch (error) {
            throw new Error(`Paperspace scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private shouldSkip(label: string): boolean {
        return SKIP_PATTERNS.some(pattern => label.includes(pattern));
    }

    private parseGpuCount(label: string): number {
        // Match patterns like "A6000x4", "H100x8", etc.
        const match = label.match(/x(\d+)$/);
        return match ? parseInt(match[1], 10) : 1;
    }

    /**
     * Normalize GPU model name for consistent display.
     * - Strip generation prefix (Ampere, Hopper) - keep Tesla and Quadro
     * - Strip VRAM suffix (80G, 32G, etc.)
     * - Add NVIDIA prefix
     */
    private normalizeGpuModel(gpuName: string): string {
        // Strip generation prefix (keep Tesla and Quadro for correct identification)
        let normalized = gpuName
            .replace(/^Ampere\s+/i, '')
            .replace(/^Hopper\s+/i, '');

        // Strip VRAM suffix (e.g., "80G", "32G", "80G PCIe")
        normalized = normalized
            .replace(/\s+\d+G\s*$/i, '')       // "A100 80G" -> "A100"
            .replace(/\s+\d+G\s+/i, ' ');      // "A100 80G PCIe" -> "A100 PCIe"

        // Normalize PCIe
        normalized = normalized.replace(/\bPCIE\b/gi, 'PCIe');

        // Add space after RTX if missing (e.g., "RTX4000" -> "RTX 4000")
        normalized = normalized.replace(/\bRTX(\d)/gi, 'RTX $1');

        // Clean up whitespace
        normalized = normalized.replace(/\s+/g, ' ').trim();

        // Add NVIDIA prefix
        if (!normalized.toLowerCase().startsWith('nvidia')) {
            normalized = 'NVIDIA ' + normalized;
        }

        return normalized;
    }
}

export const paperspaceScraper = new PaperspaceScraper();
