import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { "/api/handoff/*": ["./docs/*.md", "./docs/FINDINGS_REPORT.json", "./docs/screenshots/findings/*", "./AI_USAGE.md"] },
  serverExternalPackages: ["pg"],
  turbopack: { root: process.cwd() },
};
export default config;
