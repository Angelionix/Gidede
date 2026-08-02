import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  allowedDevOrigins: ["*.space-z.ai"],
};

export default nextConfig;
