'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClient, signInWithGoogle, signInWithKakao } from '@/lib/supabase';

export default function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState<'google' | 'kakao' | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getClient().auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/home');
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  const handleGoogle = async () => {
    setLoading('google');
    await signInWithGoogle();
    // OAuth redirect 발생 — 이 이후 코드는 실행되지 않음
  };

  const handleKakao = async () => {
    setLoading('kakao');
    await signInWithKakao();
    // OAuth redirect 발생 — 이 이후 코드는 실행되지 않음
  };

  if (checking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0f0f0f]">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0f0f0f] text-white min-h-screen">
      <div className="flex-1" />

      {/* 중앙 콘텐츠 */}
      <div className="flex flex-col items-center px-6 pb-2">
        {/* 로고 */}
        <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center mb-6 text-3xl">
          ✨
        </div>
        <h1 className="text-4xl font-semibold tracking-tight mb-1">3rd Vibe</h1>
        <p className="text-xs tracking-[0.2em] text-white/40 mb-2 uppercase">써드 바이브</p>
        <p className="text-xs text-white/30 mb-10 text-center leading-relaxed">
          부산의 진짜 인연을 연결합니다<br />
          <span className="text-white/20">3번의 만남을 보장하는 프리미엄 소개팅</span>
        </p>

        {/* 특징 */}
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

      {/* 로그인 버튼 */}
      <div className="px-6 pb-12 flex flex-col gap-3">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-white/50">직장인 인증 기반 · 부산 거주/활동자 전용</span>
        </div>

        {/* 카카오 로그인 */}
        <button
          onClick={handleKakao}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-3.5 text-sm font-semibold
                     active:scale-[0.98] transition-transform disabled:opacity-60"
          style={{ backgroundColor: '#FEE500', color: '#191919' }}
        >
          {loading === 'kakao' ? (
            <div className="w-4 h-4 rounded-full border-2 border-[#191919]/30 border-t-[#191919] animate-spin" />
          ) : (
            <>
              {/* 카카오 아이콘 */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3C6.477 3 2 6.477 2 10.714c0 2.716 1.626 5.1 4.084 6.535L5.08 20.83a.5.5 0 0 0 .718.543l4.35-2.882c.605.087 1.22.132 1.852.132 5.523 0 10-3.477 10-7.71C22 6.477 17.523 3 12 3z"/>
              </svg>
              카카오로 계속하기
            </>
          )}
        </button>

        {/* 구글 로그인 */}
        <button
          onClick={handleGoogle}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-3 bg-white text-[#1a1a1a] rounded-2xl py-3.5 text-sm font-semibold
                     active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {loading === 'google' ? (
            <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
          ) : (
            <>
              {/* 구글 아이콘 */}
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 계속하기
            </>
          )}
        </button>

        <p className="text-[10px] text-white/20 text-center mt-1">
          로그인 시 서비스 이용약관 및 개인정보처리방침에 동의합니다
        </p>
      </div>
    </div>
  );
}
