import './globals.css';
import type { Metadata } from 'next';
import { Noto_Serif_TC } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/components/ui/Toast';
import dynamic from 'next/dynamic';

const BackgroundCanvas = dynamic(() => import('@/components/ui/BackgroundCanvas'), {
  ssr: false,
});

// 標題 serif 自架；內文改用系統中文字型（PingFang TC／Microsoft JhengHei），
// 避免下載三套 Google Fonts、13 種權重（實測首頁 858KB）。
const notoSerif = Noto_Serif_TC({
  weight: '600',
  display: 'swap',
  variable: '--font-serif-tc',
  preload: false,
});

export const metadata: Metadata = {
  title: '玄覺空間 - AI 玄學占卜',
  description: '結合傳統玄學智慧與 AI 科技的占卜系統',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={notoSerif.variable} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background-primary text-foreground-primary transition-colors duration-300 relative min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <BackgroundCanvas />
              <div className="relative z-10">
                {children}
              </div>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
