/** @type {import("next").NextConfig} */
const nextConfig = {
  // Enable Partial Prerendering (PPR) via Cache Components
  // This provides static shell + streaming dynamic content
  cacheComponents: true,
  experimental: {
    // REMINDER: new React compiler to memoize components automatically
    reactCompiler: true,
    // Enable View Transitions API for smooth cross-fade navigation
    // This provides smooth transitions between pages (e.g., /llms <-> /gpus)
    // EXPERIMENTAL: Test thoroughly - may have edge cases
    viewTransition: true,
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
