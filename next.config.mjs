import { withPlausibleProxy } from "next-plausible";

/** @type {import("next").NextConfig} */
const nextConfig = {
  // React Compiler 1.0.0+ has improved react-hook-form compatibility.
  // If issues arise in settings-submit-form.tsx or settings-contact-form.tsx,
  // add the "use no memo" directive at the top of those files.
  reactCompiler: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "radix-ui",
      "@tanstack/react-table",
      "@tanstack/react-query",
      "@tanstack/react-virtual",
      "@lobehub/icons",
      "recharts",
      "zod",
    ],
  },
};

export default withPlausibleProxy({ subdirectory: "px", scriptName: "a" })(nextConfig);
