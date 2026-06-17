'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getClient, getSavedPhone, sendPhoneOtp, verifyPhoneOtp } from '@/lib/supabase';

// 전화번호 마스킹: +821012345678 → 010-****-5678
function maskPhone(e164: string): string {
  const local = e164.startsWith('+82') ? '0' + e164.slice(3) : e164;
  if (local.length === 11) {
    return `${local.slice(0, 3)}-****-${local.slice(7)}`;
  }
  return '****';
}

export default function WelcomePage() {
  const router = useRouter();

  // 'checking' | 'landing' | 'relogin'
  const [view, setView] = useState<'checking' | 'landing' | 'relogin'>('checking');
  const [savedPhone, setSavedPhoneState] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const client = getClient();
    client.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        router.replace('/home');
        return;
      }

      // 세션 없음 → 저장된 전화번호 확인
      const phone = getSavedPhone();
      if (phone) {
        setSavedPhoneState(phone);
        // 자동 OTP 발송
        try {
          await sendPhoneOtp(phone);
          setOtpSent(true);
        } catch {
          // OTP 발송 실패해도 relogin 화면은 표시
        }
        setView('relogin');
      } else {
        setView('landing');
      }
    });
  }, [router]);

  const handleOtpInput = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) return;
    setError(''); setLoading(true);
    const { error: err } = await verifyPhoneOtp(savedPhone, code);
    setLoading(false);
    if (err) {
      setError('인증번호가 올바르지 않습니다.');
      return;
    }
    // 인증 성공 → 홈으로
    router.replace('/home');
  };

  const handleResend = async () => {
    setError('');
    setOtp(['', '', '', '', '', '']);
    await sendPhoneOtp(savedPhone);
    setOtpSent(true);
    inputsRef.current[0]?.focus();
  };

  // ── 로딩 중 ───────────────────────────────────────────────
  if (view === 'checking') {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0f0f0f]">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  // ── 재로그인 화면 (저장된 번호로 OTP 자동 발송) ──────────────
  if (view === 'relogin') {
    return (
      <div className="flex-1 flex flex-col bg-[#0f0f0f] text-white min-h-screen">
        <div className="flex-1 flex flex-col justify-center px-6">
          {/* 상단 */}
          <div className="mb-8">
            <div className="text-2xl mb-2">🔐</div>
            <h1 className="text-2xl font-semibold mb-1">다시 돌아오셨네요</h1>
            <p className="text-sm text-white/50 leading-relaxed">
              {otpSent
                ? <>저장된 번호 <span className="text-white/80 font-mono">{maskPhone(savedPhone)}</span>로<br />인증번호를 발송했습니다</>
                : <>저장된 번호 <span className="text-white/80 font-mono">{maskPhone(savedPhone)}</span>로<br />인증번호 발송 중...</>
              }
            </p>
          </div>

          {/* OTP 입력 */}
          <div className="flex gap-2 mb-6">
            {otp.map((v, i) => (
              <input
                key={i}
                ref={el => { inputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={v}
                onChange={e => handleOtpInput(i, e.target.value)}
                onKeyDown={e => handleOtpKey(i, e)}
                className="flex-1 h-14 bg-white/10 border border-white/20 rounded-xl text-center text-xl font-semibold text-white focus:outline-none focus:border-white/60 focus:bg-white/15"
              />
            ))}
          </div>

          {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

          {/* 로그인 버튼 */}
          <button
            onClick={handleVerify}
            disabled={loading || otp.join('').length < 6}
            className="w-full bg-white text-[#0f0f0f] rounded-2xl py-3.5 text-sm font-semibold
                       disabled:opacity-40 active:scale-[0.98] transition-transform mb-4"
          >
            {loading ? '확인 중...' : '로그인'}
          </button>

          {/* 재발송 */}
          <button
            onClick={handleResend}
            className="text-sm text-white/40 text-center py-2"
          >
            인증번호 다시 받기
          </button>
        </div>

        {/* 다른 계정으로 */}
        <div className="px-6 pb-12">
          <button
            onClick={() => {
              setView('landing');
            }}
            className="w-full text-center text-xs text-white/30 py-3"
          >
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  // ── 기본 랜딩 화면 ────────────────────────────────────────
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
