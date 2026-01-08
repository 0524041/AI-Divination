import './globals.css';
import type { Metadata } from 'next';
import { Noto_Serif_TC } from 'next/font/google';

const notoSerifTC = Noto_Serif_TC({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'optional', // Use 'optional' to prevent layout shift from font swap
  preload: true,
  fallback: ['serif', 'system-ui'], // Specify fallback fonts
});

export const metadata: Metadata = {
  title: 'AI 算命 - 六爻占卜',
  description: '結合 AI 的智慧算命系統，提供六爻占卜解盤服務',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" className={notoSerifTC.className}>
      <body className="font-chinese antialiased">{children}</body>
    </html>
  );
}
