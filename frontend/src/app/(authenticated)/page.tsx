'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initializeApiClient } from '@/lib/api-init';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Compass, Sparkles, Star, Calendar, ArrowRight } from 'lucide-react';

const divinationTypes = [
  {
    id: 'liuyao',
    name: '六爻占卜',
    enName: 'Liu Yao Divination',
    description: '洞察變化的哲學。結合傳統易經六爻排盤，以 AI 智慧解析當下困惑。',
    icon: Compass,
    available: true,
    href: '/liuyao',
  },
  {
    id: 'tarot',
    name: '塔羅占卜',
    enName: 'Tarot Reading',
    description: '潛意識的鏡像。透過西方神祕學智慧，在象徵與直覺中尋找指引。',
    icon: Sparkles,
    available: true,
    href: '/tarot',
  },
  {
    id: 'ziwei',
    name: '紫微斗數',
    enName: 'Purple Star Astrology',
    description: '命運的星圖。推算人生運勢走向，解析命宮與流年運程。',
    icon: Star,
    available: true,
    href: '/ziwei',
  },
  {
    id: 'naming',
    name: '姓名學分析',
    enName: 'Name Analysis',
    description: '文字能量的探索。分析姓名五行與靈動數，解讀名字中的奧秘。',
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
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-24">
        <div className="text-center mb-16 space-y-4">
          <Skeleton className="h-10 w-48 mx-auto rounded-full opacity-50" />
          <Skeleton className="h-4 w-64 mx-auto rounded-full opacity-30" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex-1 flex flex-col items-center">
      {/* Hero Section */}
      <div className="text-center mb-16 md:mb-24 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/5 text-accent text-sm font-medium border border-accent/20 mb-4 backdrop-blur-sm">
          <Sparkles size={14} />
          <span>AI 賦能的玄學智慧</span>
        </div>

        <h2 className="text-4xl md:text-5xl lg:text-6xl font-heading font-medium text-foreground-primary tracking-tight">
          早安，<span className="text-accent relative inline-block">
            {user?.username || '旅人'}
            <span className="absolute -bottom-2 left-0 right-0 h-1 bg-accent/20 rounded-full blur-sm"></span>
          </span>
        </h2>

        <p className="text-foreground-secondary text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-light">
          在數位與靈性的交匯處，尋找生命的答案。<br className="hidden sm:block" />
          選擇一種占卜方式，開啟您的探索之旅。
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 w-full max-w-5xl">
        {divinationTypes.map((type, index) => {
          const IconComponent = type.icon;
          return (
            <Card
              key={type.id}
              variant="glass"
              padding="lg"
              className={`group flex flex-col justify-between h-full min-h-[220px] transition-all duration-500 animate-fade-up
                ${type.available
                  ? 'cursor-pointer'
                  : 'opacity-70 grayscale-[30%]'
                }`}
              style={{ animationDelay: `${index * 150}ms` }}
              onClick={() => type.available && router.push(type.href)}
            >
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div className={`p-3.5 rounded-2xl transition-all duration-500 ${type.available ? 'bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white group-hover:shadow-lg group-hover:shadow-accent/40 group-hover:scale-110' : 'bg-neutral-100 dark:bg-white/5 text-foreground-muted'}`}>
                    <IconComponent className="w-7 h-7" strokeWidth={1.5} />
                  </div>
                  {type.available && (
                    <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-1">
                      <ArrowRight className="text-accent" />
                    </div>
                  )}
                  {!type.available && (
                    <Badge variant="outline" className="border-foreground-muted text-foreground-muted opacity-80 decoration-slice">Coming Soon</Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-heading font-semibold text-foreground-primary group-hover:text-accent transition-colors">
                    {type.name}
                  </h3>
                  <p className="text-xs font-sans text-accent/60 uppercase tracking-widest font-semibold">{type.enName}</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-foreground-secondary leading-relaxed text-sm font-light">
                  {type.description}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
