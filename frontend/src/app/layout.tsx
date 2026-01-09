import './globals.css';
import type { Metadata } from 'next';
import { Noto_Serif_TC } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';

const notoSerifTC = Noto_Serif_TC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'optional', // Use 'optional' to prevent layout shift from font swap
  preload: true,
  fallback: ['serif', 'system-ui'], // Specify fallback fonts
});

export const metadata: Metadata = {
  title: '玄覺空間 - AI 玄學占卜',
  description: '結合傳統玄學智慧與 AI 科技的占卜系統，提供六爻、塔羅等專業解盤服務',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" className={notoSerifTC.className}>
      <body className="font-chinese antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
