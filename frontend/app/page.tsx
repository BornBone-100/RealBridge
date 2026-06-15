'use client';

import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col bg-[#0f0f0f] text-white min-h-screen">
      <div className="flex-1" />

      {/* 중앙 콘텐츠 */}
      <div className="flex flex-col items-center px-6 pb-2">
        {/* 로고 아이콘 */}
        <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center mb-6 text-3xl">
          ✨
        </div>

        {/* 앱 이름 */}
        <h1 className="text-4xl font-semibold tracking-tight mb-1">3rd Vibe</h1>
        <p className="text-xs tracking-[0.2em] text-white/40 mb-2 uppercase">써드 바이브</p>
        <p className="text-xs text-white/30 mb-10 text-center leading-relaxed">
          부산의 진짜 인연을 연결합니다<br />
          <span className="text-white/20">3번의 만남을 보장하는 프리미엄 소개팅</span>
        </p>

        {/* 핵심 특징 3가지 */}
        <div className="flex gap-4 mb-10">
          {[
            { icon: '🔐', label: '직장 인증' },
            { icon: '💰', label: '3회 보장제' },
            { icon: '💬', label: '컨시어지' },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center text-lg">
                {f.icon}
              </div>
              <span className="text-[10px] text-white/40">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="px-6 pb-12 flex flex-col gap-3">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-white/50">직장인 인증 기반 · 부산 거주/활동자 전용</span>
        </div>

        <button
          onClick={() => router.push('/onboarding')}
          className="w-full bg-white text-[#0f0f0f] rounded-2xl py-3.5 text-sm font-semibold
                     active:scale-[0.98] transition-transform"
        >
          3rd Vibe 시작하기
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
