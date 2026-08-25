'use client';

/**
 * 首頁（Ticket 15）— 墨與金風格，framer-motion 入場（尊重 useReducedMotion）
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Compass, Sparkles, Star, CalendarDays, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { initializeApiClient } from '@/lib/api-init';
import { useAuth } from '@/contexts/AuthContext';

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
    icon: CalendarDays,
    available: false,
    href: '#',
  },
];

export default function HomePage() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeApiClient().then(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-24">
        <div className="mb-16 space-y-4 text-center">
          <Skeleton className="mx-auto h-10 w-48 rounded-full opacity-50" />
          <Skeleton className="mx-auto h-4 w-64 rounded-full opacity-30" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex w-full max-w-7xl flex-1 flex-col items-center mx-auto px-4 py-12 sm:px-6 md:py-20 lg:px-8">
      {/* Hero */}
      <motion.div
        className="mb-14 space-y-6 text-center md:mb-20"
        initial={reducedMotion ? undefined : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.6, ease: 'easeOut' }}
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-sm font-medium text-accent backdrop-blur-sm">
          <Sparkles size={14} aria-hidden />
          <span>AI 賦能的玄學智慧</span>
        </div>

        <h1 className="font-heading text-4xl font-medium tracking-tight text-foreground-primary md:text-5xl lg:text-6xl">
          {greeting()}，<span className="relative inline-block text-accent">
            {user?.username || '旅人'}
            <span className="absolute -bottom-2 left-0 right-0 h-1 rounded-full bg-accent/20 blur-sm" aria-hidden />
          </span>
        </h1>

        <p className="mx-auto max-w-2xl text-lg font-light leading-relaxed text-foreground-secondary md:text-xl">
          在數位與靈性的交匯處，尋找生命的答案。<br className="hidden sm:block" />
          選擇一種占卜方式，開啟您的探索之旅。
        </p>
      </motion.div>

      {/* Cards */}
      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
        {divinationTypes.map((type, index) => {
          const IconComponent = type.icon;
          return (
            <motion.div
              key={type.id}
              initial={reducedMotion ? undefined : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { duration: 0.5, delay: 0.15 + index * 0.12, ease: 'easeOut' }
              }
            >
              <Card
                variant="glass"
                padding="lg"
                hover={type.available}
                role={type.available ? 'link' : undefined}
                aria-label={type.name}
                tabIndex={type.available ? 0 : -1}
                onKeyDown={(e) => {
                  if (!type.available) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(type.href);
                  }
                }}
                onClick={() => type.available && router.push(type.href)}
                className={`group flex h-full min-h-[220px] cursor-pointer flex-col justify-between ${
                  type.available ? '' : 'pointer-events-none opacity-60 grayscale-[30%]'
                }`}
              >
                <div>
                  <div className="mb-6 flex items-start justify-between">
                    <div
                      className={`rounded-2xl p-3.5 transition-all duration-500 ${
                        type.available
                          ? 'bg-accent/10 text-accent group-hover:scale-110 group-hover:bg-accent group-hover:text-background-primary group-hover:shadow-lg group-hover:shadow-accent/40'
                          : 'bg-foreground-muted/10 text-foreground-muted'
                      }`}
                    >
                      <IconComponent className="h-7 w-7" strokeWidth={1.5} aria-hidden />
                    </div>

                    {type.available ? (
                      <span className="translate-x-0 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                        <ArrowRight className="text-accent" aria-hidden />
                      </span>
                    ) : (
                      <Badge variant="outline">敬請期待</Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h2 className="font-heading text-2xl font-semibold text-foreground-primary transition-colors group-hover:text-accent">
                      {type.name}
                    </h2>
                    <p className="text-xs font-semibold uppercase tracking-widest text-accent/70">{type.enName}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-light leading-relaxed text-foreground-secondary">
                    {type.description}
                  </p>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </main>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 12) return '早安';
  if (hour < 18) return '午安';
  return '晚安';
}
