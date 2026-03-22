import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@grocery-tracker/db",
    "@grocery-tracker/ai",
    "@grocery-tracker/jobs",
    "@grocery-tracker/shared",
  ],
};

export default nextConfig;
