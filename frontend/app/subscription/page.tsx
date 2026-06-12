'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// ── 플랜 데이터 ─────────────────────────────────────────
type BillingCycle = 'monthly' | 'yearly';

const PLANS = {
  basic: {
    name: '베이직',
    price: { monthly: 0, yearly: 0 },
    badge: null,
    tagline: '기본적인 탐색을 시작하세요',
    features: [
      { text: '휴대폰 본인 인증 (OTP)', included: true },
      { text: '일 20명 프로필 열람', included: true },
      { text: '하루 5회 좋아요', included: true },
      { text: '기본 매칭 필터', included: true },
      { text: '트루노트 인증 배지', included: false },
      { text: '프리미엄 전용 매칭 필터', included: false },
      { text: '무제한 좋아요 & 프로필 열람', included: false },
      { text: '자동 번역 메시지', included: false },
    ],
    cta: '베이직으로 시작하기',
    ctaStyle: 'border',
  },
  premium: {
    name: '트루노트',
    price: { monthly: 29000, yearly: 249000 },
    badge: '추천',
    tagline: '검증된 사람과 진지한 만남을',
    features: [
      { text: '여권/신분증 100% 신원 검증', included: true },
      { text: '실시간 3D 안면 인식', included: true },
      { text: '직업 · 학력 증명서 심사', included: true },
      { text: '트루노트 프리미엄 배지 부여', included: true },
      { text: '프리미엄 전용 매칭 필터', included: true },
      { text: '무제한 좋아요 & 프로필 열람', included: true },
      { text: '자동 번역 메시지', included: true },
      { text: '24시간 우선 고객 지원', included: true },
    ],
    cta: '트루노트 멤버십 시작하기',
    ctaStyle: 'filled',
  },
};

// ── 체크 아이콘 ─────────────────────────────────────────
function Check({ on }: { on: boolean }) {
  return (
    <svg
      className={`w-4 h-4 flex-shrink-0 ${on ? 'text-[#0f0f0f]' : 'text-gray-200'}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ── 트루노트 배지 컴포넌트 ───────────────────────────────
function TruenoteBadge({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg'
    ? 'text-sm px-3 py-1 gap-1.5'
    : 'text-xs px-2.5 py-0.5 gap-1';
  return (
    <span className={`inline-flex items-center rounded-full bg-[#0f0f0f] text-white font-medium ${cls}`}>
      <svg className={size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
      TrueNote
    </span>
  );
}

// ── 메인 ────────────────────────────────────────────────
export default function SubscriptionPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState<string | null>(null);

  const yearlyDiscount = Math.round(
    ((PLANS.premium.price.monthly * 12 - PLANS.premium.price.yearly) /
      (PLANS.premium.price.monthly * 12)) * 100
  );

  const handleSelect = async (plan: 'basic' | 'premium') => {
    setLoading(plan);
    // 베이직: 바로 홈으로
    if (plan === 'basic') {
      router.push('/home');
      return;
    }
    // 프리미엄: 결제 플로우 → KYC 플로우
    // TODO: 결제 처리 후 /verify?tier=premium 으로 이동
    await new Promise((r) => setTimeout(r, 800));
    router.push('/verify?tier=premium');
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen">
      {/* 헤더 */}
      <div className="px-6 pt-14 pb-2 flex items-center">
        <button onClick={() => router.back()} className="text-gray-400 mr-4">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10">
        {/* 타이틀 */}
        <div className="mb-8 mt-2">
          <div className="flex items-center gap-2 mb-3">
            <TruenoteBadge size="lg" />
          </div>
          <h1 className="text-2xl font-medium text-gray-900 leading-tight mb-2">
            가장 안전하고<br />확실한 만남
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            신원 검증이 완료된 회원들과<br />진정성 있는 대화를 시작하세요.
          </p>
        </div>

        {/* 빌링 토글 */}
        <div className="flex items-center bg-gray-100 rounded-2xl p-1 mb-6">
          {(['monthly', 'yearly'] as BillingCycle[]).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBilling(cycle)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5
                ${billing === cycle ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
            >
              {cycle === 'monthly' ? '월간 결제' : '연간 결제'}
              {cycle === 'yearly' && (
                <span className="text-xs bg-[#0f0f0f] text-white px-1.5 py-0.5 rounded-full">
                  -{yearlyDiscount}%
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 플랜 카드 */}
        <div className="flex flex-col gap-4">

          {/* 프리미엄 카드 (먼저, 강조) */}
          <div className="relative border-[1.5px] border-[#0f0f0f] rounded-3xl p-5 bg-white">
            {/* 추천 배지 */}
            <div className="absolute -top-3 left-5">
              <span className="bg-[#0f0f0f] text-white text-xs font-medium px-3 py-1 rounded-full">
                추천
              </span>
            </div>

            <div className="flex items-start justify-between mb-1 mt-1">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-base font-medium text-gray-900">트루노트 멤버십</h2>
                  <TruenoteBadge />
                </div>
                <p className="text-xs text-gray-400">{PLANS.premium.tagline}</p>
              </div>
            </div>

            <div className="my-4 pb-4 border-b border-gray-100">
              <span className="text-3xl font-medium text-gray-900">
                ₩{billing === 'monthly'
                  ? PLANS.premium.price.monthly.toLocaleString()
                  : Math.round(PLANS.premium.price.yearly / 12).toLocaleString()}
              </span>
              <span className="text-sm text-gray-400">/월</span>
              {billing === 'yearly' && (
                <p className="text-xs text-gray-400 mt-0.5">
                  연 ₩{PLANS.premium.price.yearly.toLocaleString()} 청구 · 매월 대비 ₩{(PLANS.premium.price.monthly * 12 - PLANS.premium.price.yearly).toLocaleString()} 절약
                </p>
              )}
            </div>

            <ul className="space-y-3 mb-5">
              {PLANS.premium.features.map((f) => (
                <li key={f.text} className="flex items-center gap-2.5 text-sm text-gray-700">
                  <Check on={f.included} />
                  <span className={f.included ? '' : 'text-gray-300 line-through'}>{f.text}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelect('premium')}
              disabled={loading === 'premium'}
              className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                         disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {loading === 'premium' ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  처리 중...
                </span>
              ) : PLANS.premium.cta}
            </button>

            {/* 보안 안내 */}
            <p className="text-center text-xs text-gray-300 mt-3 flex items-center justify-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              언제든지 해지 가능 · 첫 달 100% 환불 보장
            </p>
          </div>

          {/* 베이직 카드 */}
          <div className="border border-gray-200 rounded-3xl p-5 bg-white">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="text-base font-medium text-gray-900 mb-0.5">베이직 멤버십</h2>
                <p className="text-xs text-gray-400">{PLANS.basic.tagline}</p>
              </div>
            </div>

            <div className="my-4 pb-4 border-b border-gray-100">
              <span className="text-3xl font-medium text-gray-900">무료</span>
            </div>

            <ul className="space-y-3 mb-5">
              {PLANS.basic.features.map((f) => (
                <li key={f.text} className="flex items-center gap-2.5 text-sm">
                  <Check on={f.included} />
                  <span className={f.included ? 'text-gray-700' : 'text-gray-300'}>{f.text}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelect('basic')}
              disabled={loading === 'basic'}
              className="w-full bg-white text-gray-600 border border-gray-200 rounded-2xl py-3.5 text-sm
                         disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {loading === 'basic' ? '처리 중...' : PLANS.basic.cta}
            </button>
          </div>
        </div>

        {/* 투트랙 설명 */}
        <div className="mt-6 bg-gray-50 rounded-2xl p-4">
          <h3 className="text-xs font-medium text-gray-700 mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            투트랙 인증 시스템이란?
          </h3>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 flex-shrink-0 mt-0.5">1</div>
              <div>
                <p className="text-xs font-medium text-gray-700">베이직: 기본 생태계 보호</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">휴대폰 OTP 인증으로 매크로 봇과 대량 스팸 계정을 1차 차단합니다.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#0f0f0f] flex items-center justify-center text-xs text-white flex-shrink-0 mt-0.5">2</div>
              <div>
                <p className="text-xs font-medium text-gray-700">트루노트: 절대적 신뢰 보장</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">여권 대조 + 3D 안면 인식으로 심사를 통과한 회원에게만 배지를 부여합니다.</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-6">
          <h3 className="text-xs font-medium text-gray-500 mb-3">자주 묻는 질문</h3>
          {[
            { q: '트루노트 인증은 얼마나 걸리나요?', a: '신분증 제출 후 영업일 기준 1~2일 내 완료됩니다.' },
            { q: '개인정보는 어떻게 보호되나요?', a: '인증 완료 후 원본 서류는 즉시 폐기되며, 인증 여부 결과만 저장됩니다.' },
            { q: '해지하면 배지가 사라지나요?', a: '구독 종료 시 프리미엄 필터와 배지는 만료됩니다.' },
          ].map((item) => (
            <div key={item.q} className="py-3.5 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-700 mb-1">{item.q}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
