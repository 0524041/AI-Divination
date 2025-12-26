import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,  // 移除開發模式懸浮球
  reactStrictMode: true,
  allowedDevOrigins: [
    "192.168.50.86",
    "219.69.22.3",
    "localhost",
    "127.0.0.1",
    "::1"
  ]
};

export default nextConfig;
