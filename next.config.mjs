/** @type {import("next").NextConfig} */
const nextConfig = {
  // Enable Partial Prerendering (PPR) via Cache Components
  // This provides static shell + streaming dynamic content
  cacheComponents: true,
  experimental: {
    // REMINDER: new React compiler to memoize components automatically
    reactCompiler: true,
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

export default nextConfig;
