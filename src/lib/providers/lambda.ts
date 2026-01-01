import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { LambdaPriceRow, ProviderResult } from '@/types/pricing';
import type { ProviderScraper } from './types';

const PRICING_URL = 'https://lambda.ai/pricing';

class LambdaScraper implements ProviderScraper {
  name = 'lambda';
  url = PRICING_URL;
  scrapeIntervalMinutes = 1440;
  enabled = true;

  async scrape(): Promise<ProviderResult> {
    try {
      // Fetch the pricing page with proper browser headers
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
        throw new Error(`Failed to fetch Lambda pricing page: ${response.status}`);
      }

      const html = await response.text();
      const sourceHash = crypto.createHash('sha256').update(html).digest('hex');

      // Parse the HTML and extract pricing data
      const rows = this.parsePricingPage(html);

      return {
        provider: "lambda",
        rows,
        observedAt: new Date().toISOString(),
        sourceHash,
      };
    } catch (error) {
      throw new Error(`Lambda scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parsePricingPage(html: string): LambdaPriceRow[] {
    const rows: LambdaPriceRow[] = [];
    const observedAt = new Date().toISOString();

    // Lambda's new site (circa Dec 2025) embeds pricing data as JSON with escaped HTML
    // Each tab has format: {"contentHtml":"...","label":"8x"}
    // Use a pattern that matches each tab object individually to avoid backtracking

    const tabPattern = /\{"contentHtml":"((?:[^"\\]|\\.)*)","label":"(\d+)x"\}/g;
    let tabMatch;

    const tabs: Array<{ contentHtml: string; gpuCount: number }> = [];
    while ((tabMatch = tabPattern.exec(html)) !== null) {
      tabs.push({
        contentHtml: tabMatch[1],
        gpuCount: parseInt(tabMatch[2])
      });
    }

    if (tabs.length === 0) {
      console.warn('Could not find Lambda pricing tabs');
      return rows;
    }

    for (const tab of tabs) {
      const gpuCount = tab.gpuCount;

      // Parse the escaped HTML content
      // The contentHtml contains escaped sequences like \u003C for <
      const tableHtml = tab.contentHtml
        .replace(/\\u003C/g, '<')
        .replace(/\\u003E/g, '>')
        .replace(/\\u002F/g, '/')
        .replace(/\\"/g, '"');

      const $ = cheerio.load(tableHtml);

      // Find pricing rows - they use class like "_pricingRow_z1nfw_36"
      $('tr[class*="_pricingRow_"]').each((_, row) => {
        const $row = $(row);

        // GPU model is in th with data-label="Plan" or first th
        const gpuModel = $row.find('th').first().text().trim();

        // Extract specs from td elements with data-label attributes
        const vramText = $row.find('td[data-label*="VRAM"]').text().trim();
        const vcpusText = $row.find('td[data-label*="vCPU"]').text().trim();
        const ramText = $row.find('td[data-label="RAM"]').text().trim();
        const storageText = $row.find('td[data-label*="STORAGE"]').text().trim();
        const priceText = $row.find('td[data-label*="PRICE"]').text().trim();

        // Parse VRAM per GPU (e.g., "80 GB" -> 80)
        const vramMatch = vramText.match(/(\d+)/);
        const vramPerGpu = vramMatch ? parseInt(vramMatch[1]) : 0;

        // Parse vCPUs (already total for instance)
        const vcpus = parseInt(vcpusText) || 0;

        // Parse RAM (already total for instance - handle GiB -> keep as-is)
        const ramMatch = ramText.match(/(\d+(?:\.\d+)?)/);
        const systemRamGb = ramMatch ? parseFloat(ramMatch[1]) : 0;

        // Parse price per GPU (e.g., "$3.29" -> 3.29)
        const priceMatch = priceText.match(/\$([\d.]+)/);
        const pricePerGpu = priceMatch ? parseFloat(priceMatch[1]) : 0;

        // Skip if we don't have essential data
        if (!gpuModel || vramPerGpu === 0 || pricePerGpu === 0) {
          return; // Skip this row
        }

        // Calculate TOTAL instance values (Lambda shows per-GPU for VRAM and price)
        const totalVramGb = vramPerGpu * gpuCount;
        const totalPriceHourUsd = Math.round(pricePerGpu * gpuCount * 100) / 100; // Round to 2 decimals

        // Create instance ID
        const instanceId = `${gpuCount}x-${gpuModel.toLowerCase().replace(/\s+/g, '-')}`;

        rows.push({
          provider: 'lambda',
          source_url: PRICING_URL,
          observed_at: observedAt,
          instance_id: instanceId,
          gpu_model: gpuModel,
          gpu_count: gpuCount,
          vram_gb: totalVramGb,
          vcpus: vcpus,
          system_ram_gb: systemRamGb,
          storage: storageText,
          price_unit: 'instance_hour',
          price_hour_usd: totalPriceHourUsd,
          raw_cost: `$${totalPriceHourUsd.toFixed(2)}/hr`,
          class: 'GPU',
          type: 'Virtual Machine',
        });
      });
    }

    return rows;
  }
}

// Export a singleton instance
export const lambdaScraper = new LambdaScraper();
