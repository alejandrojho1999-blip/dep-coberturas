import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['217.216.92.14'],
  serverExternalPackages: ['yahoo-finance2', 'xlsx', 'mathjs', 'docx'],
};

export default nextConfig;
