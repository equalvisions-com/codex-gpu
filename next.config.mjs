/** @type {import("next").NextConfig} */
const nextConfig = {
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
