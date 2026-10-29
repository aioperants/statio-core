import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Photos are shrunk in the browser; a price-list PDF sent for "build it for me" can be up to ~2.5 MB.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Security headers are set in src/proxy.ts so they follow the environment without a rebuild.
};

export default withNextIntl(nextConfig);
