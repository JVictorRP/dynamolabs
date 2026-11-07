import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera um servidor enxuto para rodar em container no VPS.
  output: "standalone",
  // Código do formulário público do site (workspace), escrito em TypeScript.
  transpilePackages: ["@dynamo/public-lead"],
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
