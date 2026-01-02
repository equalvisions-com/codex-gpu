import { getToolsPage } from "@/lib/tools-loader";

export function buildToolsSchema(
  payload: Awaited<ReturnType<typeof getToolsPage>> | null,
): Record<string, unknown> | null {
  if (!payload || !payload.data?.length) {
    return null;
  }

  const items = payload.data.slice(0, 50).map((tool) => {
    const additionalProperty: Array<{
      "@type": "PropertyValue";
      name: string;
      value: string | number;
    }> = [];

    pushProperty(additionalProperty, "Category", tool.category);
    pushProperty(additionalProperty, "Runtime", tool.stack);
    pushProperty(additionalProperty, "Pricing", tool.price);
    pushProperty(additionalProperty, "Open Source", tool.oss);

    return {
      "@type": "DataFeedItem",
      item: {
        "@type": "SoftwareApplication",
        name: tool.name ?? "Unknown Tool",
        description: tool.description ?? undefined,
        applicationCategory: tool.category ?? "ML tool",
        operatingSystem: "Cloud",
        publisher: tool.developer
          ? {
              "@type": "Organization",
              name: tool.developer,
            }
          : undefined,
        license: tool.license ?? undefined,
        url: tool.url ?? undefined,
        identifier: tool.stable_key ?? tool.id,
        additionalProperty: additionalProperty.length
          ? additionalProperty
          : undefined,
      },
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "DataFeed",
    name: "ML Tools Feed",
    dateModified: new Date().toISOString(),
    dataFeedElement: items,
  };
}

function pushProperty(
  list: Array<{ "@type": "PropertyValue"; name: string; value: string | number }>,
  name: string,
  value: unknown,
) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return;
  }
  list.push({
    "@type": "PropertyValue",
    name,
    value: typeof value === "string" ? value : Number(value),
  });
}
