'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// PortOne V2 브라우저 SDK (CDN) 타입
declare global {
  interface Window {
    PortOne?: {
      requestPayment: (p: Record<string, unknown>) => Promise<{
        paymentId?: string; code?: string; message?: string;
      }>;
    };
  }
}

const PORTONE_STORE_ID    = process.env.NEXT_PUBLIC_PORTONE_STORE_ID    ?? '';
const PORTONE_CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? '';

type PayStep = 'intro' | 'pay' | 'processing' | 'done' | 'error';

export default function DepositPage() {
  const router = useRouter();
  const [payStep,   setPayStep]   = useState<PayStep>('intro');
  const [method,    setMethod]    = useState<'card' | 'kakao' | 'naver'>('card');
  const [errorMsg,  setErrorMsg]  = useState('');
  const [userId,    setUserId]    = useState('');

  // PortOne SDK 스크립트 동적 로드
  useEffect(() => {
    const script = document.createElement('script');
    script.src   = 'https://cdn.portone.io/v2/browser-sdk.js';
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  // 로그인 유저 ID 획득
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  const handlePay = async () => {
    if (!window.PortOne) {
      setErrorMsg('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
      setPayStep('error');
      return;
    }
    if (!PORTONE_STORE_ID || !PORTONE_CHANNEL_KEY) {
      setErrorMsg('결제 설정 오류입니다. 관리자에게 문의해 주세요.');
      setPayStep('error');
      return;
    }

    setPayStep('processing');
    try {
      const paymentId = `3rdvibe-${Date.now()}`;

      const resp = await window.PortOne.requestPayment({
        storeId:     PORTONE_STORE_ID,
        channelKey:  PORTONE_CHANNEL_KEY,
        paymentId,
        orderName:   '3rd Vibe 매칭 서비스 (수수료+보증금)',
        totalAmount: 60_000,
        currency:    'KRW',
        payMethod:   method === 'card' ? 'CARD' : 'EASY_PAY',
        easyPay:     method !== 'card'
          ? { easyPayProvider: method === 'kakao' ? 'KAKAOPAY' : 'NAVERPAY' }
          : undefined,
        customData:  { user_id: userId },
      });

      // 결제 취소 또는 실패
      if (!resp.paymentId || resp.code) {
        throw new Error(resp.message ?? '결제가 취소되었습니다.');
      }

      // 백엔드 검증 & DB 기록
      const verify = await fetch('/api/payment/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ payment_id: resp.paymentId, user_id: userId }),
      });

      if (!verify.ok) {
        const err = await verify.json().catch(() => ({}));
        throw new Error(err.detail ?? '결제 검증에 실패했습니다.');
      }

      setPayStep('done');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '결제 처리 중 오류가 발생했습니다.';
      setErrorMsg(msg);
      setPayStep('error');
    }
  };

  // ── 완료 화면 ─────────────────────────────────────────
  if (payStep === 'done') return (
    <div className="flex flex-col min-h-screen bg-white items-center justify-center px-6 text-center">
      <div className="text-5xl mb-5">🎊</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">결제 완료!</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-8">
        3rd Vibe팀이 맞춤 매칭을 시작합니다.<br />
        보통 3~5 영업일 내 첫 매칭을 안내드려요.
      </p>

      {/* 영수증 카드 */}
      <div className="w-full bg-gray-50 rounded-3xl p-5 mb-8 text-left space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">결제 내역</h3>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">서비스 수수료</span>
          <span className="font-medium text-gray-900">30,000원</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">약속 보증금</span>
          <span className="font-medium text-gray-900">30,000원</span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex justify-between text-sm font-bold">
          <span className="text-gray-900">합계</span>
          <span className="text-gray-900">60,000원</span>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 mt-1">
          <p className="text-xs text-blue-600 leading-relaxed">
            🔒 보증금 30,000원은 에스크로 보관 중<br />
            3회 만남 미달 시 전액 환불됩니다
          </p>
        </div>
      </div>

      <button onClick={() => router.push('/home')}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-semibold
                   active:scale-[0.98] transition-all">
        매칭 홈으로 이동
      </button>
    </div>
  );

  if (payStep === 'processing') return (
    <div className="flex flex-col min-h-screen bg-white items-center justify-center px-6 text-center">
      <svg className="animate-spin w-10 h-10 text-gray-300 mb-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      <p className="text-sm text-gray-500">결제 처리 중...</p>
    </div>
  );

  if (payStep === 'error') return (
    <div className="flex flex-col min-h-screen bg-white items-center justify-center px-6 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">결제 실패</h2>
      <p className="text-sm text-gray-500 mb-8">{errorMsg}</p>
      <button onClick={() => setPayStep('pay')}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium">
        다시 시도하기
      </button>
    </div>
  );

  // ── 소개 화면 ─────────────────────────────────────────
  if (payStep === 'intro') return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="px-6 pt-14 pb-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/>
          </svg>
        </button>
        <h1 className="text-base font-bold text-gray-900">3회 만남 보장제 결제</h1>
      </div>

      <div className="flex-1 px-6 pb-10 overflow-y-auto">
        {/* 금액 카드 */}
        <div className="bg-[#0f0f0f] rounded-3xl p-6 mb-6 text-white">
          <p className="text-xs text-white/50 mb-3 uppercase tracking-wider">총 결제 금액</p>
          <p className="text-5xl font-bold mb-4">60,000<span className="text-2xl font-normal ml-1">원</span></p>
          {/* 분할 설명 */}
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-white/10 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium">서비스 수수료</p>
                <p className="text-xs text-white/50 mt-0.5">매칭 큐레이션 비용 · 소멸</p>
              </div>
              <span className="text-base font-bold">30,000원</span>
            </div>
            <div className="flex justify-between items-center bg-white/10 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium">약속 보증금</p>
                <p className="text-xs text-white/50 mt-0.5">에스크로 보관 · 3회 미달 시 환불</p>
              </div>
              <span className="text-base font-bold">30,000원</span>
            </div>
          </div>
        </div>

        {/* 보장 내용 */}
        <h3 className="text-sm font-bold text-gray-900 mb-3">3회 만남 보장제 안내</h3>
        {[
          {
            icon: '🤝', title: '3번의 실제 만남을 목표로',
            desc: '3rd Vibe 매니저가 직접 큐레이션하고 일정을 조율합니다',
          },
          {
            icon: '💰', title: '보증금은 에스크로 안전 보관',
            desc: '결제 즉시 별도 에스크로에 보관 — 임의 사용 절대 불가',
          },
          {
            icon: '↩️', title: '귀책사유 없는 중단 시 보증금 전액 환불',
            desc: '어느 쪽의 잘못도 없이 만남이 어려워지면 30,000원을 돌려드립니다',
          },
          {
            icon: '✅', title: '서비스 수수료는 소멸',
            desc: '매칭 큐레이션 서비스에 대한 비용으로, 환불되지 않습니다',
          },
        ].map(item => (
          <div key={item.title} className="flex gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl flex-shrink-0">
              {item.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{item.title}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-8">
          <p className="text-xs text-amber-700 leading-relaxed">
            ⚠️ 고의적 노쇼, 허위 인증, 서비스 규정 위반 시<br />
            보증금 환불이 제한됩니다.
          </p>
        </div>

        <button onClick={() => setPayStep('pay')}
          className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-semibold
                     active:scale-[0.98] transition-all">
          결제 수단 선택하기
        </button>
      </div>
    </div>
  );

  // ── 결제 수단 선택 ────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="px-6 pt-14 pb-4 flex items-center gap-4">
        <button onClick={() => setPayStep('intro')} className="w-8 h-8 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/>
          </svg>
        </button>
        <h1 className="text-base font-bold text-gray-900">결제 수단 선택</h1>
      </div>

      <div className="flex-1 px-6 pb-10">
        {/* 금액 요약 */}
        <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-5 py-4 mb-6">
          <div>
            <p className="text-xs text-gray-400">결제 금액</p>
            <p className="text-sm text-gray-500 mt-0.5">수수료 30,000 + 보증금 30,000</p>
          </div>
          <span className="text-xl font-bold text-gray-900">60,000원</span>
        </div>

        <p className="text-xs text-gray-400 mb-3">결제 수단</p>
        <div className="space-y-2 mb-8">
          {([
            { id: 'card',  label: '신용/체크카드', icon: '💳', sub: 'VISA · Master · 국내 카드 모두 가능' },
            { id: 'kakao', label: '카카오페이',     icon: '💛', sub: '카카오계정 간편결제' },
            { id: 'naver', label: '네이버페이',     icon: '🟢', sub: '네이버 포인트 적립 가능' },
          ] as const).map(m => (
            <button key={m.id} onClick={() => setMethod(m.id)}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-[1.5px] transition-all text-left
                ${method === m.id ? 'border-[#0f0f0f] bg-gray-50' : 'border-gray-100'}`}>
              <span className="text-2xl">{m.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>
              </div>
              {method === m.id && (
                <div className="w-5 h-5 rounded-full bg-[#0f0f0f] flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center mb-4">
          PortOne (구 아임포트) · SSL 256-bit 보안 결제
        </p>

        <button onClick={handlePay}
          className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-semibold
                     active:scale-[0.98] transition-all">
          60,000원 결제하기
        </button>
      </div>
    </div>
  );
}
