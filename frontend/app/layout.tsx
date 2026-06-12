import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'RealBridge',
  description: '진짜 인연을 연결하는 크로스보더 데이팅 앱',
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
