import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://deploybase.ai";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/signin", "/signup", "/signout", "/reset-password", "/_next/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
