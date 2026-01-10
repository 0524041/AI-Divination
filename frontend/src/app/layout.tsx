import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';

// 使用 CSS 字型堆疊，避免建置時需要網路請求
// Google Fonts 將在客戶端通過 CSS @import 載入（若無法載入則 fallback 到系統字型）

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
    <html lang="zh-TW">
      <body className="font-chinese antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

