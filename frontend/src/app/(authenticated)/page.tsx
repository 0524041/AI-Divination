'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initializeApiClient } from '@/lib/api-init';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Compass, Sparkles, Star, Calendar } from 'lucide-react';

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
    available: true,
    href: '/ziwei',
  },
  {
    id: 'naming',
    name: '姓名學分析',
    description: '分析姓名五行與靈動數，解析運勢',
    icon: Calendar,
    available: false,
    href: '#',
  },
];

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeApiClient().then(() => {
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <main className="w-full max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-12 flex flex-col items-center">
          <Compass className="w-20 h-20 text-foreground-muted mb-4 animate-spin-slow" />
          <Skeleton className="h-6 w-32" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-8 flex-1">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground-primary">
          歡迎回來，<span className="text-accent">{user?.username}</span>
        </h2>
        <p className="text-foreground-secondary text-lg">選擇一種算命方式，開始你的命理探索之旅</p>
      </div>

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
  );
}
