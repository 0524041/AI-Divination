/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // 本地預設直連 localhost:8000；Vercel 上瀏覽器改走 NEXT_PUBLIC_API_URL 直連後端，
    // 此 rewrite 僅供同源代理情境（BACKEND_INTERNAL_URL）或本地開發使用
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
