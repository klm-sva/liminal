import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "utfs.io" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Native binaries and ESM-only packages used by the pipeline cannot be
  // bundled by webpack — they are loaded at runtime on the server only.
  serverExternalPackages: [
    "@napi-rs/canvas",
    "sharp",
    "pdfjs-dist",
    "pdf-parse",
    "canvas",
    "xlsx",
    "@anthropic-ai/sdk",
    "@googlemaps/google-maps-services-js",
  ],
};

export default nextConfig;
