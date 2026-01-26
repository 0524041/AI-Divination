import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import dynamic from 'next/dynamic';
import { Inter, Noto_Sans_TC, Noto_Serif_TC } from 'next/font/google';

const BackgroundCanvas = dynamic(() => import('@/components/ui/BackgroundCanvas'), {
  ssr: false,
});

// Load fonts
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const notoSansTC = Noto_Sans_TC({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans',
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
      <body className={`${inter.variable} ${notoSansTC.variable} ${notoSerifTC.variable} font-sans antialiased bg-background-primary text-foreground-primary transition-colors duration-300 relative min-h-screen`}>
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
