import path from "node:path";
import type { NextConfig } from "next";

// `npx convex dev` writes CONVEX_URL and CONVEX_SITE_URL to the repository root's .env.local.
const root = path.resolve(__dirname, "../..");
try {
  process.loadEnvFile(path.join(root, ".env.local"));
} catch {
  // No local Convex deployment configured yet; NEXT_PUBLIC_CONVEX_URL may come from the host (e.g. Vercel).
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "",
    NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL ?? "",
  },
  turbopack: {
    root,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
