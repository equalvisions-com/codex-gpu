import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Optimize package imports - only load modules you actually use
  // This is especially important for icon libraries like lucide-react
  // and UI libraries like @radix-ui that export many modules
  experimental: {
    optimizePackageImports: [
      "lucide-react", // Icon library - optimize to only load used icons
      "@radix-ui/react-accordion",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@tanstack/react-table", // Table library - optimize imports
      "@tanstack/react-virtual", // Virtual scrolling - optimize imports
      "recharts", // Chart library - optimize to only load used chart types
    ],
  },
  async redirects() {
    return [
      {
        source: "/i",
        destination: "/infinite",
        permanent: true,
      },
      {
        source: "/vercel",
        destination: "/infinite",
        permanent: true,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
