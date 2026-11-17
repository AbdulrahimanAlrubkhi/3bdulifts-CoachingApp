import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets a check build go to a separate folder while `npm run dev` keeps using .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Every signed-in page shows per-user data, so it is rendered per request by design.
    // This turns off the dev-only "could be instant" warnings for all of them.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
