import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import BackgroundCanvas from '@/components/ui/BackgroundCanvas';

import { Zen_Maru_Gothic, Noto_Serif_TC } from 'next/font/google';

// Load fonts
const zenMaruGothic = Zen_Maru_Gothic({
  weight: ['300', '400', '500', '700', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-zen',
});

const notoSerifTC = Noto_Serif_TC({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: '玄覺空間 - AI 玄學占卜',
  description: '結合傳統玄學智慧與 AI 科技的占卜系統',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={`${zenMaruGothic.className} antialiased bg-background-primary text-foreground-primary transition-colors duration-300 relative min-h-screen`}>
        <ThemeProvider>
          <AuthProvider>
            <BackgroundCanvas />
            <div className="relative z-10">
              {children}
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
