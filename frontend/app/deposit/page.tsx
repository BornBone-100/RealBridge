'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getClient } from '@/lib/supabase';

// 토스페이먼츠 V1 CDN 타입
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestPayment: (method: string, params: Record<string, unknown>) => void;
    };
  }
}

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? '';

// 금액 상수
const SERVICE_FEE = 15_000;   // 매칭비 (소멸)
const DEPOSIT    = 25_000;   // 보증금 (3회 만남 후 환불)
const TOTAL      = SERVICE_FEE + DEPOSIT;  // 40,000원

// 필수 동의 항목
const AGREEMENTS = [
  {
    id: 'fee_nonrefund',
    label: '매칭비 15,000원은 환불되지 않습니다.',
    detail: '매칭 큐레이션 서비스 비용으로, 결제 즉시 소멸됩니다.',
  },
  {
    id: 'deposit_refund',
    label: '보증금 25,000원은 3회 만남 완료 후 전액 반환됩니다.',
    detail: '3회 만남을 모두 진행한 경우 신청일로부터 7영업일 내에 환불됩니다.',
  },
  {
    id: 'photo_cert',
    label: '매 만남마다 장소·날짜가 보이는 인증 사진을 제출해야 합니다.',
    detail: '인증 사진을 제출하지 않으면 해당 회차는 만남으로 인정되지 않으며, 보증금 반환 조건에서 제외됩니다.',
  },
  {
    id: 'noshow',
    label: '고의적 노쇼·허위 인증 시 보증금이 반환되지 않을 수 있습니다.',
    detail: '상대방의 귀책 없이 본인이 약속을 어긴 경우 보증금 전부 또는 일부가 몰수될 수 있습니다.',
  },
  {
    id: 'partial_refund',
    label: '양측 귀책 없이 3회 미달 종료 시 잔여 보증금을 환불합니다.',
    detail: '불가피한 사정으로 3회 미달 종료되는 경우, 진행된 만남 비율을 제외한 보증금을 돌려드립니다.',
  },
] as const;

type AgreementId = typeof AGREEMENTS[number]['id'];
type PayStep = 'intro' | 'agreement' | 'pay' | 'processing' | 'done' | 'error';

export default function DepositPage() {
  const router = useRouter();
  const [payStep,    setPayStep]    = useState<PayStep>('intro');
  const [method,     setMethod]     = useState<'card' | 'kakao' | 'naver'>('card');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [userName,   setUserName]   = useState('');
  const [expanded,   setExpanded]   = useState<AgreementId | null>(null);
  const [checked,    setChecked]    = useState<Set<AgreementId>>(new Set());
  const allChecked = checked.size === AGREEMENTS.length;

  // 토스 SDK CDN 로드
  useEffect(() => {
    if (document.getElementById('toss-sdk')) return;
    const script = document.createElement('script');
    script.id  = 'toss-sdk';
    script.src = 'https://js.tosspayments.com/v1/payment';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // 로그인 유저 정보
  useEffect(() => {
    const supabase = getClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from('users').select('name').eq('id', data.user.id).single();
      if (profile?.name) setUserName(profile.name);
    });
  }, []);

  const toggleCheck = (id: AgreementId) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const checkAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(AGREEMENTS.map(a => a.id)));
  };

  const handlePay = async () => {
    if (!window.TossPayments) {
      setErrorMsg('결제 모듈 로딩 중입니다. 잠시 후 다시 시도해 주세요.');
      setPayStep('error');
      return;
    }
    if (!TOSS_CLIENT_KEY) {
      setErrorMsg('결제 설정 오류입니다. 관리자에게 문의해 주세요.');
      setPayStep('error');
      return;
    }

    setPayStep('processing');

    try {
      const supabase = getClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const orderId = `3rdvibe-${user.id.slice(0, 8)}-${Date.now()}`;
      const tossPayments = window.TossPayments(TOSS_CLIENT_KEY);

      const baseParams = {
        amount:       TOTAL,
        orderId,
        orderName:    '3rd Vibe 매칭비 + 보증금',
        customerName: userName || '회원',
        successUrl:   `${window.location.origin}/deposit/success`,
        failUrl:      `${window.location.origin}/deposit/fail`,
      };

      if (method === 'kakao') {
        tossPayments.requestPayment('카카오페이', baseParams);
      } else if (method === 'naver') {
        tossPayments.requestPayment('네이버페이', baseParams);
      } else {
        tossPayments.requestPayment('카드', baseParams);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '결제 처리 중 오류가 발생했습니다.';
      setErrorMsg(msg);
      setPayStep('error');
    }
  };

  // ── 처리 중 ──────────────────────────────────────────────
  if (payStep === 'processing') return (
    <div className="flex flex-col min-h-screen bg-white items-center justify-center px-6 text-center">
      <svg className="animate-spin w-10 h-10 text-gray-300 mb-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <p className="text-sm text-gray-500">결제 창을 여는 중...</p>
    </div>
  );

  // ── 에러 ─────────────────────────────────────────────────
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

  // ── 소개 화면 ─────────────────────────────────────────────
  if (payStep === 'intro') return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="px-6 pt-14 pb-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-gray-900">3회 만남 보장제 결제</h1>
      </div>

      <div className="flex-1 px-6 pb-10 overflow-y-auto">
        {/* 금액 카드 */}
        <div className="bg-[#0f0f0f] rounded-3xl p-6 mb-6 text-white">
          <p className="text-xs text-white/50 mb-3 uppercase tracking-wider">총 결제 금액</p>
          <p className="text-5xl font-bold mb-4">
            {TOTAL.toLocaleString()}<span className="text-2xl font-normal ml-1">원</span>
          </p>
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-white/10 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium">매칭비</p>
                <p className="text-xs text-white/50 mt-0.5">큐레이션 비용 · 소멸</p>
              </div>
              <span className="text-base font-bold">{SERVICE_FEE.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between items-center bg-white/10 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium">약속 보증금</p>
                <p className="text-xs text-white/50 mt-0.5">에스크로 보관 · 3회 완료 후 환불</p>
              </div>
              <span className="text-base font-bold">{DEPOSIT.toLocaleString()}원</span>
            </div>
          </div>
        </div>

        {/* 주요 안내 */}
        <h3 className="text-sm font-bold text-gray-900 mb-3">3회 만남 보장제 안내</h3>
        {[
          { icon: '🤝', title: '3번의 실제 만남을 목표로', desc: '3rd Vibe 매니저가 직접 큐레이션하고 일정을 조율합니다' },
          { icon: '📸', title: '매 만남마다 인증 사진 제출 필수', desc: '장소·날짜가 보이는 사진을 제출해야 해당 회차로 인정됩니다' },
          { icon: '💰', title: '보증금은 에스크로 안전 보관', desc: '결제 즉시 별도 에스크로에 보관 — 임의 사용 절대 불가' },
          { icon: '↩️', title: '3회 완료 후 보증금 전액 환불', desc: '3회 만남 인증을 모두 완료하면 7영업일 내 보증금을 돌려드립니다' },
          { icon: '✅', title: '매칭비는 소멸', desc: '매칭 큐레이션 서비스 비용으로, 환불되지 않습니다' },
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

        <button onClick={() => setPayStep('agreement')}
          className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-semibold
                     active:scale-[0.98] transition-all">
          다음 — 약관 동의
        </button>

        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            {[
              { label: '카드', icon: '💳' },
              { label: '카카오페이', icon: '💛' },
              { label: '네이버페이', icon: '🟢' },
            ].map(m => (
              <div key={m.label}
                className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-300">SSL 256-bit 암호화 · 토스페이먼츠 안전결제</p>
        </div>
      </div>
    </div>
  );

  // ── 필수 동의 화면 ────────────────────────────────────────
  if (payStep === 'agreement') return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="px-6 pt-14 pb-4 flex items-center gap-4">
        <button onClick={() => setPayStep('intro')} className="w-8 h-8 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-gray-900">서비스 이용 필수 동의</h1>
      </div>

      <div className="flex-1 px-6 pb-10 overflow-y-auto">
        <p className="text-xs text-gray-400 mb-5 leading-relaxed">
          아래 내용을 꼼꼼히 읽고 모두 동의해야 결제를 진행할 수 있습니다.
        </p>

        {/* 전체 동의 */}
        <button onClick={checkAll}
          className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-[1.5px] mb-4 transition-all
            ${allChecked ? 'border-[#0f0f0f] bg-gray-50' : 'border-gray-200'}`}>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
            ${allChecked ? 'border-[#0f0f0f] bg-[#0f0f0f]' : 'border-gray-300'}`}>
            {allChecked && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-sm font-bold text-gray-900">아래 내용을 모두 확인했습니다</span>
        </button>

        <div className="h-px bg-gray-100 mb-4" />

        {/* 개별 동의 항목 */}
        <div className="space-y-2 mb-8">
          {AGREEMENTS.map(item => {
            const isChecked = checked.has(item.id);
            const isOpen = expanded === item.id;
            return (
              <div key={item.id}
                className={`rounded-2xl border-[1.5px] overflow-hidden transition-all
                  ${isChecked ? 'border-[#0f0f0f]' : 'border-gray-100'}`}>
                <div className="flex items-start gap-3 px-4 py-3.5">
                  <button onClick={() => toggleCheck(item.id)}
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                      ${isChecked ? 'border-[#0f0f0f] bg-[#0f0f0f]' : 'border-gray-300'}`}>
                    {isChecked && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 leading-snug">{item.label}</p>
                  </div>
                  <button onClick={() => setExpanded(isOpen ? null : item.id)}
                    className="flex-shrink-0 text-gray-400 mt-0.5">
                    <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                {isOpen && (
                  <div className="px-4 pb-3.5 ml-8">
                    <p className="text-xs text-gray-400 leading-relaxed">{item.detail}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => allChecked && setPayStep('pay')}
          disabled={!allChecked}
          className={`w-full rounded-2xl py-3.5 text-sm font-semibold transition-all
            ${allChecked
              ? 'bg-[#0f0f0f] text-white active:scale-[0.98]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
          {allChecked ? '동의 완료 — 결제 수단 선택' : `${checked.size}/${AGREEMENTS.length}개 항목 동의 필요`}
        </button>
      </div>
    </div>
  );

  // ── 결제 수단 선택 ─────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="px-6 pt-14 pb-4 flex items-center gap-4">
        <button onClick={() => setPayStep('agreement')} className="w-8 h-8 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-gray-900">결제 수단 선택</h1>
      </div>

      <div className="flex-1 px-6 pb-10">
        {/* 금액 요약 */}
        <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-5 py-4 mb-6">
          <div>
            <p className="text-xs text-gray-400">결제 금액</p>
            <p className="text-sm text-gray-500 mt-0.5">
              매칭비 {SERVICE_FEE.toLocaleString()} + 보증금 {DEPOSIT.toLocaleString()}
            </p>
          </div>
          <span className="text-xl font-bold text-gray-900">{TOTAL.toLocaleString()}원</span>
        </div>

        <p className="text-xs text-gray-400 mb-3">결제 수단</p>
        <div className="space-y-2 mb-8">
          {([
            { id: 'card',  label: '신용/체크카드', icon: '💳', sub: 'VISA · Master · 국내 카드 모두 가능' },
            { id: 'kakao', label: '카카오페이',    icon: '💛', sub: '카카오계정 간편결제' },
            { id: 'naver', label: '네이버페이',    icon: '🟢', sub: '네이버 포인트 적립 가능' },
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 text-center mb-4">
          토스페이먼츠 · SSL 256-bit 보안 결제
        </p>

        <button onClick={handlePay}
          className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-semibold
                     active:scale-[0.98] transition-all">
          {TOTAL.toLocaleString()}원 결제하기
        </button>
      </div>
    </div>
  );
}
