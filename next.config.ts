import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every admin page is per-user and dynamic, so no Cache Components here.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Admin "create post" uploads an image through a Server Action.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
