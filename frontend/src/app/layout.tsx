import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/components/ui/Toast';
import dynamic from 'next/dynamic';

const BackgroundCanvas = dynamic(() => import('@/components/ui/BackgroundCanvas'), {
  ssr: false,
});

export const metadata: Metadata = {
  title: '玄覺空間 - AI 玄學占卜',
  description: '結合傳統玄學智慧與 AI 科技的占卜系統',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+TC:wght@300;400;500;700&family=Noto+Serif+TC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
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
      </body>
    </html>
  );
}
