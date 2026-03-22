import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* Standalone output for Docker deployment (Phase 10). */
  output: "standalone",

  /* Allow backend images if needed later. */
  images: {
    remotePatterns: [],
  },
};

export default withNextIntl(nextConfig);
