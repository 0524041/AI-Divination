'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AlertCircle, Sparkles, User } from 'lucide-react';

export default function GuestLimitPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card variant="glass" padding="lg" className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-accent" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-accent mb-2">訪客試用次數已用完</h1>
          <p className="text-foreground-secondary text-lg">
            您今日的 5 次免費試用機會已全部使用
          </p>
        </div>

        <div className="bg-accent/10 border border-accent/30 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-foreground-primary mb-4 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-accent" />
            訪客模式限制
          </h2>
          <ul className="space-y-3 text-foreground-secondary">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>每天限制 5 次占卜（包含六爻、塔羅、紫微斗數）</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>無法查看歷史紀錄</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>使用固定的 DeepSeek V4 Flash AI 服務</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>無法自訂 AI 模型和參數</span>
            </li>
          </ul>
        </div>

        <div className="bg-gradient-to-r from-accent/20 to-accent/10 border border-accent/30 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-foreground-primary mb-4 flex items-center gap-2">
            <User className="w-6 h-6 text-accent" />
            註冊帳號，解鎖完整功能
          </h2>
          <ul className="space-y-3 text-foreground-secondary mb-6">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">✓</span>
              <span>無限次數占卜</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">✓</span>
              <span>完整歷史紀錄保存與查詢</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">✓</span>
              <span>使用自己的 AI API Key（Google Gemini、OpenAI、本地 AI）</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">✓</span>
              <span>自訂 AI 模型和解盤參數</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">✓</span>
              <span>多組生辰資料管理（紫微斗數）</span>
            </li>
          </ul>
          <div className="flex gap-4">
            <Button 
              variant="gold" 
              fullWidth
              onClick={() => router.push('/login')}
            >
              立即註冊
            </Button>
            <Button 
              variant="outline" 
              fullWidth
              onClick={() => router.push('/')}
            >
              返回首頁
            </Button>
          </div>
        </div>

        <div className="text-center text-sm text-foreground-muted">
          <p>明天再來訪客試用次數會自動重置喔！</p>
        </div>
      </Card>
    </div>
  );
}
