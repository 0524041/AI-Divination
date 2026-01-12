'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initializeApiClient } from '@/lib/api-init';
import { apiGet } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Compass, Sparkles, Star, Moon, Calendar } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

// 算命類型卡片
const divinationTypes = [
  {
    id: 'liuyao',
    name: '六爻占卜',
    description: '傳統易經六爻排盤，結合 AI 智慧解讀卦象',
    icon: Compass,
    available: true,
    href: '/liuyao',
  },
  {
    id: 'tarot',
    name: '塔羅占卜',
    description: '西方神秘學智慧，透過牌陣指引當下迷津',
    icon: Sparkles,
    available: true,
    href: '/tarot',
  },
  {
    id: 'ziwei',
    name: '紫微斗數',
    description: '中國傳統命理學，推算人生運勢走向',
    icon: Star,
    available: false,
    href: '#',
  },
  {
    id: 'bazi',
    name: '八字命盤',
    description: '根據出生時間，分析先天命格',
    icon: Moon,
    available: false,
    href: '#',
  },
  {
    id: 'liunian',
    name: '流年運勢',
    description: '年度運勢分析與趨吉避凶指引',
    icon: Calendar,
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
        <Card variant="glass" className="mx-4 mt-4 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Compass className="w-8 h-8 text-foreground-muted" />
            <Skeleton className="h-7 w-24" />
          </div>
          <div className="hidden md:flex items-center gap-6">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </Card>

        {/* Skeleton content */}
        <main className="w-full max-w-6xl mx-auto px-4 py-8">
          <div className="text-center mb-12 flex flex-col items-center">
            <Compass className="w-20 h-20 text-foreground-muted mb-4 animate-spin-slow" />
            <Skeleton className="h-6 w-32" />
          </div>

          {/* Skeleton cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground-primary">
            歡迎回來，<span className="text-accent">{user?.username}</span>
          </h2>
          <p className="text-foreground-secondary text-lg">選擇一種算命方式，開始你的命理探索之旅</p>
        </div>

        {/* 算命類型卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {divinationTypes.map((type) => {
            const IconComponent = type.icon;
            return (
              <Card
                key={type.id}
                variant="glass"
                padding="md"
                className={`transition-all duration-300 ${type.available
                  ? 'hover:border-accent hover:shadow-lg hover:shadow-accent/20 cursor-pointer'
                  : 'opacity-60'
                  }`}
                onClick={() => type.available && router.push(type.href)}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <IconComponent className="w-10 h-10 text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-foreground-primary">{type.name}</h3>
                      {!type.available && (
                        <Badge variant="default" size="sm">Coming Soon</Badge>
                      )}
                    </div>
                    <p className="text-foreground-secondary">{type.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      {/* 使用共用 Footer */}
      <Footer />
    </div>
  );
}
