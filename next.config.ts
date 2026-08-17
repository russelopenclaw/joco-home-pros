import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old business slug redirects are handled by src/middleware.ts
  // which returns proper 301 status codes (not 308).
  // Do NOT add business slug redirects here - middleware runs first.
};

export default nextConfig;
