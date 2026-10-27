import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old business slug redirects are handled by src/proxy.ts
  // which returns proper 301 status codes (not 308).
  // Do NOT add business slug redirects here - proxy runs first.
  // Silence multi-lockfile workspace-root inference (repo lockfile is authoritative)
  turbopack: {
    root: __dirname,
  },
  // Next issues its own trailing-slash redirect (308) BEFORE the proxy runs.
  // Disable it so src/proxy.ts can emit 301s for slash-terminated URLs
  // (308s feed GSC's "Page with redirect" report — see Aug + Oct 2026 fixes).
  skipTrailingSlashRedirect: true,
};

export default nextConfig;