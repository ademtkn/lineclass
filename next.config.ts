import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Öğrenci fotoğrafı yüklemesi (en fazla 5 MB) Server Action ile yapılıyor
    serverActions: { bodySizeLimit: "6mb" },
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
