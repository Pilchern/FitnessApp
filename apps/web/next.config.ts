import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@fitness-app/application",
    "@fitness-app/domain",
    "@fitness-app/infrastructure",
    "@fitness-app/integrations",
    "@fitness-app/jobs",
  ],
};

export default nextConfig;
