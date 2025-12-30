import { createHash } from "crypto";
import type { ProviderResult } from "@/types/pricing";
import type { ProviderScraper } from "./types";
import {
  coreweaveScraper,
  nebiusScraper,
  hyperstackScraper,
  runpodScraper,
  lambdaScraper,
  digitaloceanScraper,
  oracleScraper,
  crusoeScraper,
  flyioScraper,
  vultrScraper,
  latitudeScraper,
  oriScraper,
  voltageParkScraper,
  googleCloudScraper,
  verdaScraper,
  scalewayScraper,
  replicateScraper,
  thundercomputeScraper,
  koyebScraper,
  sesterceScraper,
  awsScraper,
  azureScraper,
  civoScraper,
  vastScraper,
  hotaisleScraper,
  alibabaScraper,
  oblivusScraper,
  paperspaceScraper,
} from "./index";

interface GpuScrapeSummary {
  provider: string;
  rowsScraped: number;
  duration: number;
  success: boolean;
  sourceHash?: string;
  error?: string;
}

interface GpuScrapeAllResult {
  providerResults: ProviderResult[];
  scrapedAt: string;
  sourceHash: string;
  summaries: GpuScrapeSummary[];
}

const DEFAULT_SCRAPERS: ProviderScraper[] = [
  coreweaveScraper,
  nebiusScraper,
  hyperstackScraper,
  runpodScraper,
  lambdaScraper,
  digitaloceanScraper,
  oracleScraper,
  crusoeScraper,
  flyioScraper,
  vultrScraper,
  latitudeScraper,
  oriScraper,
  voltageParkScraper,
  googleCloudScraper,
  verdaScraper,
  scalewayScraper,
  replicateScraper,
  thundercomputeScraper,
  koyebScraper,
  sesterceScraper,
  awsScraper,
  azureScraper,
  civoScraper,
  vastScraper,
  hotaisleScraper,
  alibabaScraper,
  oblivusScraper,
  paperspaceScraper,
];

class GpuPricingScraper {
  constructor(private readonly scrapers: ProviderScraper[] = DEFAULT_SCRAPERS) { }

  async scrapeAll(): Promise<GpuScrapeAllResult> {
    const summaries: GpuScrapeSummary[] = [];
    const providerResults: ProviderResult[] = [];

    const hash = createHash("sha256");
    const scrapedAt = new Date().toISOString();

    for (const scraper of this.scrapers) {
      const start = Date.now();
      try {
        const result = await scraper.scrape();
        providerResults.push(result);

        hash.update(scraper.name);
        hash.update(result.sourceHash ?? JSON.stringify(result.rows));

        summaries.push({
          provider: scraper.name,
          rowsScraped: result.rows.length,
          duration: Date.now() - start,
          success: true,
          sourceHash: result.sourceHash,
        });
      } catch (error) {
        summaries.push({
          provider: scraper.name,
          rowsScraped: 0,
          duration: Date.now() - start,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (providerResults.length === 0) {
      const failureSummary = summaries.map((s) => `${s.provider}: ${s.error ?? "unknown error"}`).join("; ");
      throw new Error(`All GPU pricing scrapes failed. ${failureSummary}`);
    }

    const sourceHash = hash.digest("hex");

    return {
      providerResults,
      scrapedAt,
      sourceHash,
      summaries,
    };
  }
}

export const gpuPricingScraper = new GpuPricingScraper();
