'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initializeApiClient } from '@/lib/api-init';
import { apiGet } from '@/lib/api-client';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

// 算命類型卡片
const divinationTypes = [
  {
    id: 'liuyao',
    name: '六爻占卜',
    description: '傳統易經六爻排盤，結合 AI 智慧解讀卦象',
    icon: '☯',
    available: true,
    href: '/liuyao',
  },
  {
    id: 'tarot',
    name: '塔羅占卜',
    description: '西方神秘學智慧，透過牌陣指引當下迷津',
    icon: '🔮',
    available: true,
    href: '/tarot',
  },
  {
    id: 'ziwei',
    name: '紫微斗數',
    description: '中國傳統命理學，推算人生運勢走向',
    icon: '⭐',
    available: false,
    href: '#',
  },
  {
    id: 'bazi',
    name: '八字命盤',
    description: '根據出生時間，分析先天命格',
    icon: '🌙',
    available: false,
    href: '#',
  },
  {
    id: 'liunian',
    name: '流年運勢',
    description: '年度運勢分析與趨吉避凶指引',
    icon: '📅',
    available: false,
    href: '#',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初始化 API 客戶端
    initializeApiClient().then(() => {
      checkAuth();
    });
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await apiGet('/api/auth/me');

      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        localStorage.removeItem('token');
        router.push('/login');
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        {/* Skeleton nav */}
        <div className="glass-card mx-4 mt-4 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">☯</span>
            <div className="h-7 w-24 bg-gray-700 rounded animate-pulse"></div>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="h-4 w-16 bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 w-16 bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 w-16 bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Skeleton content */}
        <main className="w-full max-w-6xl mx-auto px-4 py-8">
          <div className="text-center mb-12">
            <div className="text-6xl mb-4 animate-spin-slow">☯</div>
            <p className="text-gray-400">載入中...</p>
          </div>

          {/* Skeleton cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass-card p-6 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-700 rounded"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-6 w-24 bg-gray-700 rounded"></div>
                    <div className="h-4 w-full bg-gray-700 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* 使用共用 Navbar */}
      <Navbar />

      {/* 主內容 */}
      <main className="w-full max-w-6xl mx-auto px-4 py-8 flex-1">
        {/* 歡迎區 */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            歡迎回來，<span className="text-[var(--gold)]">{user?.username}</span>
          </h2>
          <p className="text-gray-400 text-lg">選擇一種算命方式，開始你的命理探索之旅</p>
        </div>

        {/* 算命類型卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {divinationTypes.map((type) => (
            <div
              key={type.id}
              className={`glass-card p-6 transition-all duration-300 ${type.available
                ? 'hover:border-[var(--gold)] hover:shadow-lg hover:shadow-[var(--gold)]/20 cursor-pointer'
                : 'opacity-60'
                }`}
              onClick={() => type.available && router.push(type.href)}
            >
              <div className="flex items-start gap-4">
                <div className="text-5xl">{type.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-[var(--gold)]">{type.name}</h3>
                    {!type.available && (
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">Coming Soon</span>
                    )}
                  </div>
                  <p className="text-gray-400">{type.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 使用共用 Footer */}
      <Footer />
    </div>
  );
}
