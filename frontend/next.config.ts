import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,  // 移除開發模式懸浮球
  reactStrictMode: true,
  allowedDevOrigins: [
    "219.69.22.3",
    "localhost",
    "127.0.0.1",
    "::1"
  ],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
    ];
  },
};

export default nextConfig;
