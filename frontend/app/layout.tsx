import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import SwRegistration from '@/components/SwRegistration';

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
          {/* 사업자 정보 푸터 */}
          <footer className="px-5 py-6 border-t border-gray-100 mt-auto">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              <span className="font-medium text-gray-500">3rd Vibe</span>
              {' | '}사업자등록번호: 494-37-01613 (일반과세자)
              <br />
              대표자: 김성준
              <br />
              주소: 경상남도 창원시 마산합포구 현동9길 13, 103동 503호
              <br />
              고객센터: 010-5900-6834
            </p>
          </footer>
        </div>
        <BottomNav />
        <SwRegistration />
      </body>
    </html>
  );
}
