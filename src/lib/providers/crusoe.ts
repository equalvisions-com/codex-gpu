import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { CrusoePriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';

const PRICING_URL = 'https://www.crusoe.ai/cloud/pricing';

// Complete Crusoe GPU specifications (from research)
// Maps GPU model + interface to complete hardware specs
const CRUSOE_GPU_SPECS: Record<string, { vcpus: number; ramGb: number }> = {
  // From user's research data - keys match what scraper extracts: gpuModel (gpuInterface)
  // Model names now include interface (except OAM for AMD)
  'NVIDIA B200 SXM (SXM)': { vcpus: 0, ramGb: 0 },      // Contact Sales - specs unknown, set to 0
  'NVIDIA H200 SXM (SXM)': { vcpus: 22, ramGb: 250 },   // Complete specs
  'NVIDIA H100 SXM (SXM)': { vcpus: 22, ramGb: 120 },   // Complete specs
  'AMD MI300X (OAM)': { vcpus: 30, ramGb: 250 },        // Complete specs (AMD skips OAM in model name)
  'NVIDIA A100 SXM (SXM)': { vcpus: 12, ramGb: 120 },   // Complete specs (80GB SXM)
  'NVIDIA A100 PCIe (PCIe)': { vcpus: 12, ramGb: 120 }, // Complete specs (both 80GB and 40GB PCIe use same specs)
  'NVIDIA L40S PCIe (PCIe)': { vcpus: 8, ramGb: 147 },  // Complete specs
  'NVIDIA A40 PCIe (PCIe)': { vcpus: 6, ramGb: 60 },    // Complete specs
};

class CrusoeScraper implements ProviderScraper {
  name = 'crusoe';
  url = PRICING_URL;
  scrapeIntervalMinutes = 1440;
  enabled = true;

  async scrape(): Promise<ProviderResult> {
    try {
      // Fetch the pricing page
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
        throw new Error(`Failed to fetch Crusoe pricing page: ${response.status}`);
      }

      const html = await response.text();
      const sourceHash = crypto.createHash('sha256').update(html).digest('hex');

      // Parse the HTML and extract pricing data
      const rows = this.parsePricingPage(html);

      return {
        provider: "crusoe",
        rows,
        observedAt: new Date().toISOString(),
        sourceHash,
      };
    } catch (error) {
      throw new Error(`Crusoe scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parsePricingPage(html: string): CrusoePriceRow[] {
    const rows: CrusoePriceRow[] = [];
    const observedAt = new Date().toISOString();

    const $ = cheerio.load(html);

    // Note: Crusoe migrated from table.table to Webflow div-based layout circa Dec 2025
    // The class is "prixing-item" (typo in their source)
    const gpuItems = $('.prixing-item.w-dyn-item');

    if (gpuItems.length === 0) {
      console.warn('Could not find Crusoe GPU pricing items (.prixing-item.w-dyn-item)');
      return rows;
    }

    gpuItems.each((_, item) => {
      const $item = $(item);

      // Extract GPU name from heading
      const gpuName = $item.find('.pricing-item-heading').first().text().trim();

      if (!gpuName) {
        return; // Skip rows without GPU name
      }

      // Skip non-GPU items (CPU instances, storage, etc.)
      if (!gpuName.includes('NVIDIA') && !gpuName.includes('AMD')) {
        return;
      }

      // Extract tags: first .pricing-tag.is-dark is VRAM, second .pricing-tag is interface
      const tags = $item.find('.pricing-tag');
      let gpuMem = '';
      let gpuInterface = '';

      tags.each((i, tag) => {
        const $tag = $(tag);
        const text = $tag.text().trim();
        if ($tag.hasClass('is-dark')) {
          gpuMem = text; // e.g., "80GB"
        } else if (!gpuInterface) {
          gpuInterface = text; // e.g., "SXM", "PCIe", "OAM"
        }
      });

      // Extract On-Demand pricing from the first .pricing-rich block
      const pricingBlocks = $item.find('.pricing-rich');
      const onDemandBlock = pricingBlocks.first();
      const priceText = onDemandBlock.find('p').first().text().trim() ||
        onDemandBlock.text().trim();

      // Handle instances that require contacting sales
      let priceHourUsd: number | null = null;
      let isContactSales = false;
      if (priceText.toLowerCase().includes('contact sales') || !priceText) {
        isContactSales = true;
      } else {
        // Parse price (e.g., "$3.90/GPU-hr" -> 3.90)
        const priceMatch = priceText.match(/\$?([\d.]+)/);
        priceHourUsd = priceMatch ? parseFloat(priceMatch[1]) : null;
      }

      // Parse VRAM (remove 'GB' and convert to number)
      const vramMatch = gpuMem.match(/(\d+)/);
      const vramGb = vramMatch ? parseInt(vramMatch[1]) : null;

      // Clean up GPU model name - include interface but skip OAM for AMD
      let gpuModel = gpuName;
      gpuModel = gpuModel.replace(/^Nvidia$/, 'NVIDIA').replace(/^Nvidia\s+/, 'NVIDIA '); // Fix capitalization

      // Append interface to model name (except OAM for AMD and HGX which we strip)
      if (gpuInterface && gpuInterface !== 'OAM' && gpuInterface !== 'HGX') {
        gpuModel = `${gpuModel} ${gpuInterface}`;
      }

      // Strip HGX from final model name if it got in somehow
      gpuModel = gpuModel.replace(/\bHGX\s*/gi, '').trim();

      // Get complete hardware specs from mapping (may return 0s if not mapped)
      const specsKey = `${gpuModel} (${gpuInterface})`;
      const specs = CRUSOE_GPU_SPECS[specsKey] || { vcpus: 0, ramGb: 0 };

      rows.push({
        provider: 'crusoe',
        source_url: PRICING_URL,
        observed_at: observedAt,
        instance_id: gpuName, // Use GPU name as instance ID
        gpu_model: gpuModel,
        gpu_count: 1, // Crusoe offers single GPU instances
        vram_gb: vramGb ?? 0,
        gpu_interface: gpuInterface || 'Unknown',
        vcpus: specs.vcpus,
        system_ram_gb: specs.ramGb,
        price_unit: 'gpu_hour',
        ...(isContactSales ? { contact_sales: true } : { price_hour_usd: priceHourUsd ?? 0 }),
        raw_cost: priceText || 'Contact sales',
        class: 'GPU',
        type: 'Virtual Machine',
      });
    });

    return rows;
  }
}

// Export a singleton instance
export const crusoeScraper = new CrusoeScraper();
