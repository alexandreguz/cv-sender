import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling these Node.js-only packages.
  // They use dynamic require() calls that the webpack bundler cannot statically analyse.
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
    "puppeteer-extra-plugin",
    "clone-deep",
    "merge-deep",
  ],
};

export default nextConfig;
