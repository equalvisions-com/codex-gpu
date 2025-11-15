import type { PriceRow, ProviderResult } from "@/types/pricing";

export interface ProviderScraper {
  /** Provider name */
  name: string;
  /** URL to scrape */
  url: string;
  /** Scrape interval in minutes */
  scrapeIntervalMinutes: number;
  /** Whether this scraper is enabled */
  enabled: boolean;

  /** Scrape the provider and return normalized data */
  scrape(): Promise<ProviderResult>;
}
