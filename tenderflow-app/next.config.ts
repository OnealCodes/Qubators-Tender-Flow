import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdfjs-dist on real Node resolution so its fake worker file
  // (pdf.worker.mjs) loads correctly inside API routes.
  serverExternalPackages: ["pdfjs-dist", "pg"],
};

export default nextConfig;
