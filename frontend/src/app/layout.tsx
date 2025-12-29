import './globals.css';
import type { Metadata } from 'next';

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
    <html lang="zh-TW">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-chinese antialiased">{children}</body>
    </html>
  );
}
