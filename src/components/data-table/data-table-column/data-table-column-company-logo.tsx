import { cn } from "@/lib/utils";
import Image from "next/image";

interface CompanyLogoProps {
  companyName: string;
  className?: string;
  size?: number;
}

export function DataTableColumnCompanyLogo({
  companyName,
  className,
  size = 24,
}: CompanyLogoProps) {
  // Map company names to their logo URLs
  const getLogoUrl = (company: string): string | null => {
    const logos: Record<string, string> = {
      "OpenAI": "https://images.ctfassets.net/kftzwdyauwt9/3M8rPrJsENQL5tjaDzo6SL/f0f85c8e27090123c767ac3c8237b401/Blossom_Dark.svg",
      "Google": "https://cdn.worldvectorlogo.com/logos/google-1-1.svg",
      "Microsoft": "https://cdn.worldvectorlogo.com/logos/microsoft-5.svg",
      "Anthropic": "https://cdn.worldvectorlogo.com/logos/anthropic-2.svg",
      "Stability AI": "https://cdn.worldvectorlogo.com/logos/stability-ai.svg",
      "Midjourney": "https://cdn.worldvectorlogo.com/logos/midjourney-1.svg",
      "Hugging Face": "https://cdn.worldvectorlogo.com/logos/huggingface-2.svg",
      "Cohere": "https://cdn.worldvectorlogo.com/logos/cohere-1.svg",
      "Anyscale": "https://cdn.worldvectorlogo.com/logos/anyscale.svg",
      "Replicate": "https://cdn.worldvectorlogo.com/logos/replicate-2.svg",
      "Scale AI": "https://cdn.worldvectorlogo.com/logos/scale-ai.svg",
      "Databricks": "https://cdn.worldvectorlogo.com/logos/databricks.svg",
      "Weights & Biases": "https://cdn.worldvectorlogo.com/logos/weights-and-biases.svg",
      "Together AI": "https://cdn.worldvectorlogo.com/logos/together-ai.svg",
      "Cerebras": "https://cdn.worldvectorlogo.com/logos/cerebras-systems.svg",
      "Inflection AI": "https://cdn.worldvectorlogo.com/logos/inflection-ai.svg",
      "Mistral AI": "https://cdn.worldvectorlogo.com/logos/mistral-ai.svg",
      "Claude AI": "https://cdn.worldvectorlogo.com/logos/claude-ai.svg",
      "Perplexity AI": "https://cdn.worldvectorlogo.com/logos/perplexity-ai.svg",
    };

    return logos[company] || null; // no fallback logo
  };

  const logoUrl = getLogoUrl(companyName);

  if (!logoUrl) {
    // No logo available, show first letter of company name
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <span className="text-xs font-bold text-muted-foreground bg-muted rounded w-6 h-6 flex items-center justify-center">
          {companyName?.charAt(0)?.toUpperCase() || '?'}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <Image
        src={logoUrl}
        alt={`${companyName} logo`}
        width={size}
        height={size}
        className="object-contain"
        onError={(e) => {
          // Fallback to text if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          const parent = target.parentElement;
          if (parent && companyName) {
            parent.innerHTML = `<span class="text-xs font-bold text-muted-foreground bg-muted rounded w-6 h-6 flex items-center justify-center">${companyName.charAt(0).toUpperCase()}</span>`;
          }
        }}
      />
    </div>
  );
}
