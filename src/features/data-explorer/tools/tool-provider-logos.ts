export const TOOL_PROVIDER_LOGOS: Record<
  string,
  {
    src: string;
    alt: string;
  }
> = {
  // Optional overrides for irregular favicon keys.
  // Keys are lowercased + trimmed tool names.
  baseten: { src: "/logos/favicons/Baseten.png", alt: "Baseten" },
  "weights and biases": { src: "/logos/favicons/WeightsBiases.png", alt: "Weights & Biases" },
  "weights & biases": { src: "/logos/favicons/WeightsBiases.png", alt: "Weights & Biases" },
};

function toFaviconBase(provider: string) {
  const parts = provider
    .split(/[^A-Za-z0-9]+/g)
    .filter(Boolean);
  return parts.join("");
}

export function getToolProviderLogo(provider?: string | null) {
  if (!provider) return null;
  const key = provider.toLowerCase().trim();
  const override = TOOL_PROVIDER_LOGOS[key];
  if (override) return override;

  const base = toFaviconBase(provider);
  if (!base) return null;
  return {
    src: `/logos/favicons/${base}.png`,
    alt: provider,
  };
}
