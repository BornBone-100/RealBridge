import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: '3rd Vibe | 써드 바이브',
  description: '부산 직장인을 위한 프리미엄 소개팅 · 3회 만남 보장제',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f0f0f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-white font-sans antialiased">
        {/* 모바일 중앙 정렬 래퍼 */}
        <div className="mx-auto max-w-sm min-h-screen flex flex-col relative overflow-x-hidden pb-16">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
