/** @type {import('next').NextConfig} */

// 後端位址（Vercel 部署時由公開環境變數注入）；未設時同源相對路徑。
const backendUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const isDev = process.env.NODE_ENV !== 'production';

// 前端 HTML 的 CSP（API 回應的 CSP 由後端 middleware 提供）
const connectSrc = ["'self'"];
if (backendUrl) connectSrc.push(backendUrl);
if (isDev) connectSrc.push('ws:', 'wss:');

const scriptSrc = ["'self'", "'unsafe-inline'"]; // Next.js inline bootstrap 需要
if (isDev) scriptSrc.push("'unsafe-eval'"); // 僅開發模式的 HMR 需要

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(' ')}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  `connect-src ${connectSrc.join(' ')}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    // 本地開發必需：NEXT_PUBLIC_API_URL 未設時，前端以相對路徑 /api/* 經此 rewrite
    // 代理到本機後端；Vercel 部署時瀏覽器直連 NEXT_PUBLIC_API_URL，此 rewrite 不生效。
    const backend = (process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000').replace(/\/$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
