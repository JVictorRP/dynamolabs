import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Site estático: o servidor só entrega arquivos (nginx atrás do Traefik).
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
