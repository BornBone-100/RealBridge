'use client';

import { useRouter } from 'next/navigation';

const FLAGS = [
  { label: '한국', el: (
    <div className="relative w-8 h-5 overflow-hidden rounded-sm">
      <div className="absolute inset-0 bg-white" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-red-600" />
      </div>
    </div>
  )},
  { label: '일본', el: (
    <div className="relative w-8 h-5 overflow-hidden rounded-sm bg-white flex items-center justify-center">
      <div className="w-3 h-3 rounded-full bg-red-600" />
    </div>
  )},
  { label: '대만', el: (
    <div className="relative w-8 h-5 overflow-hidden rounded-sm flex">
      <div className="w-2/5 bg-blue-800" />
      <div className="w-1/5 bg-white" />
      <div className="w-2/5 bg-red-500" />
    </div>
  )},
];

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col bg-[#0f0f0f] text-white min-h-screen">
      {/* 상단 여백 */}
      <div className="flex-1" />

      {/* 중앙 콘텐츠 */}
      <div className="flex flex-col items-center px-6 pb-2">
        {/* 국기 */}
        <div className="flex gap-2 mb-6">
          {FLAGS.map((f) => (
            <div key={f.label}>{f.el}</div>
          ))}
        </div>

        {/* 로고 */}
        <h1 className="text-3xl font-medium tracking-tight mb-2">RealBridge</h1>
        <p className="text-xs tracking-widest text-white/40 mb-1">
          GENUINE CONNECTIONS ACROSS BORDERS
        </p>
        <p className="text-xs text-white/30 mb-10 text-center leading-relaxed">
          한국 · 일본 · 대만을 잇는<br />진짜 인연 매칭 서비스
        </p>
      </div>

      {/* 하단 버튼 영역 */}
      <div className="px-6 pb-12 flex flex-col gap-3">
        {/* 인증 배지 */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-xs text-white/50">여권 인증 기반 · 가짜 계정 0% 지향</span>
        </div>

        <button
          onClick={() => router.push('/onboarding')}
          className="w-full bg-white text-[#0f0f0f] rounded-2xl py-3.5 text-sm font-medium
                     active:scale-[0.98] transition-transform"
        >
          시작하기
        </button>

        <button
          onClick={() => router.push('/home')}
          className="w-full bg-transparent text-white/60 border border-white/15
                     rounded-2xl py-3.5 text-sm active:scale-[0.98] transition-transform"
        >
          이미 계정이 있어요
        </button>
      </div>
    </div>
  );
}
