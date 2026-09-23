import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old business slug redirects are handled by src/proxy.ts
  // which returns proper 301 status codes (not 308).
  // Do NOT add business slug redirects here - proxy runs first.
  // Silence multi-lockfile workspace-root inference (repo lockfile is authoritative)
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;