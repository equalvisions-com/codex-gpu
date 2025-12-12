export const PROVIDER_LOGOS: Record<
  string,
  {
    src: string;
    alt: string;
  }
> = {
  coreweave: { src: "/logos/coreweave.png", alt: "CoreWeave" },
  nebius: { src: "/logos/nebius.png", alt: "Nebius" },
  hyperstack: { src: "/logos/hyperstack.png", alt: "Hyperstack" },
  runpod: { src: "/logos/runpod.png", alt: "RunPod" },
  lambda: { src: "/logos/lambda.png", alt: "Lambda" },
  digitalocean: { src: "/logos/digitalocean.png", alt: "DigitalOcean" },
  oracle: { src: "/logos/oracle.png", alt: "Oracle" },
  crusoe: { src: "/logos/crusoe.png", alt: "Crusoe" },
};

export function getGpuProviderLogo(provider?: string | null) {
  if (!provider) return null;
  const key = provider.toLowerCase().trim();
  return PROVIDER_LOGOS[key] ?? null;
}
