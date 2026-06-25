'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getClient } from '@/lib/supabase';

// 포트원 V1 (iamport) CDN 타입
declare global {
  interface Window {
    IMP?: {
      init: (merchantUid: string) => void;
      request_pay: (params: Record<string, unknown>, callback?: (rsp: PortOneResponse) => void) => void;
    };
  }
}

interface PortOneResponse {
  success: boolean;
  imp_uid: string;
  merchant_uid: string;
  error_msg?: string;
}

const IMP_KEY = process.env.NEXT_PUBLIC_PORTONE_IMP_KEY ?? '';

// 금액 상수
const SERVICE_FEE = 15_000;
const DEPOSIT     = 15_000;
const TOTAL       = SERVICE_FEE + DEPOSIT; // 30,000원

// 필수 동의 항목
const AGREEMENTS = [
  {
    id: 'fee_nonrefund',
    label: '매칭비 15,000원은 환불되지 않습니다.',
    detail: '매칭 큐레이션 서비스 비용으로, 결제 즉시 소멸됩니다. 매칭 성사 여부와 무관하게 반환되지 않습니다.',
  },
  {
    id: 'deposit_condition',
    label: '보증금 15,000원은 본인 귀책사유가 없을 때 반환됩니다.',
    detail: '약속을 지키려는 의지가 있고, 만남이 불발된 사유가 본인에게 없는 경우 보증금 전액을 환불해 드립니다. 반대로 본인의 귀책사유(노쇼·일방적 취소·잠수 등)로 만남이 무산될 경우 보증금은 반환되지 않습니다.',
  },
  {
    id: 'fault_definition',
    label: '본인 귀책사유의 범위를 이해하고 동의합니다.',
    detail: '귀책사유란 ① 당일 연락 없는 노쇼 ② 합의 없는 일방적 일정 취소 ③ 2회 이상 만남 회피 ④ 허위 인증 사진 제출 ⑤ 서비스 규정 위반 행위를 포함합니다. 귀책사유 판단은 3rd Vibe 운영팀이 양측 의견을 청취하여 최종 결정합니다.',
  },
  {
    id: 'photo_cert',
    label: '매 만남마다 장소·날짜가 보이는 인증 사진을 제출해야 합니다.',
    detail: '인증 사진을 제출하지 않으면 해당 회차는 만남으로 인정되지 않습니다. 단, 인증 사진 미제출 자체가 귀책사유로 간주되지는 않으며, 실제 만남 여부를 종합적으로 판단합니다.',
  },
  {
    id: 'counterpart_fault',
    label: '상대방 귀책사유로 만남이 불발될 경우 보증금을 환불받습니다.',
    detail: '상대방의 귀책사유로 3회 만남이 이루어지지 않은 경우, 본인의 보증금은 전액 환불됩니다. 환불은 귀책사유 확인 후 7영업일 이내 처리됩니다.',
  },
] as const;

type AgreementId = typeof AGREEMENTS[number]['id'];
type PayStep = 'intro' | 'agreement' | 'pay' | 'processing' | 'error';

export default function DepositPage() {
  const router = useRouter();
  const [payStep,  setPayStep]  = useState<PayStep>('intro');
  const [method,   setMethod]   = useState<'card' | 'kakao' | 'naver'>('card');
  const [errorMsg, setErrorMsg] = useState('');
  const [userName, setUserName] = useState('');
  const [userId,   setUserId]   = useState('');
  const [expanded, setExpanded] = useState<AgreementId | null>(null);
  const [checked,  setChecked]  = useState<Set<AgreementId>>(new Set());
  const allChecked = checked.size === AGREEMENTS.length;

  // 포트원 SDK CDN 로드
  useEffect(() => {
    if (document.getElementById('portone-sdk')) return;
    const script = document.createElement('script');
    script.id    = 'portone-sdk';
    script.src   = 'https://cdn.iamport.kr/v1/iamport.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // 로그인 유저 정보
  useEffect(() => {
    const supabase = getClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
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
    if (!window.IMP) {
      setErrorMsg('결제 모듈 로딩 중입니다. 잠시 후 다시 시도해 주세요.');
      setPayStep('error');
      return;
    }
    if (!IMP_KEY) {
      setErrorMsg('결제 설정 오류입니다. 관리자에게 문의해 주세요.');
      setPayStep('error');
      return;
    }

    // ── 팝업 차단 우회 ──────────────────────────────────────────────────
    // Chrome은 async 컨텍스트에서의 window.open()을 차단합니다.
    // 클릭 핸들러의 동기 컨텍스트(await 이전)에서 빈 창을 미리 열어두고,
    // PortOne SDK가 나중에 호출하는 window.open()을 가로채 재활용합니다.
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const origOpen = window.open.bind(window) as typeof window.open;
    let preOpenedWin: Window | null = null;

    if (!isMobile) {
      preOpenedWin = origOpen(
        'about:blank',
        'portone_pay',
        'width=800,height=700,top=100,left=100,scrollbars=yes,resizable=yes'
      );

      if (preOpenedWin) {
        // PortOne SDK의 window.open 호출을 가로채 미리 연 창을 재사용
        (window as Window & { open: typeof window.open }).open = function (
          url?: string | URL,
          target?: string,
          _features?: string
        ): Window | null {
          if (preOpenedWin && !preOpenedWin.closed && url && String(url) !== 'about:blank') {
            preOpenedWin.location.href = String(url);
            return preOpenedWin;
          }
          return origOpen(url, target, _features);
        };
      }
    }
    // ────────────────────────────────────────────────────────────────────

    setPayStep('processing');

    try {
      window.IMP.init(IMP_KEY);

      const merchantUid = `3rdvibe-${userId.slice(0, 8)}-${Date.now()}`;
      const redirectUrl = `${window.location.origin}/deposit/success`;

      const pgMethod: Record<string, string> = {
        card:  'card',
        kakao: 'kakaopay',
        naver: 'naverpay',
      };

      window.IMP.request_pay(
        {
          pg:           'html5_inicis', // KG이니시스 (테스트: INIpayTest, 실연동 후 동일 pg 유지)
          pay_method:   pgMethod[method],
          merchant_uid: merchantUid,
          name:         '3rd Vibe 매칭비 + 보증금',
          amount:       TOTAL,
          buyer_name:   userName || '회원',
          m_redirect_url: redirectUrl,  // 모바일 리다이렉트
        },
        (rsp: PortOneResponse) => {
          // window.open 복원
          (window as Window & { open: typeof window.open }).open = origOpen;
          // 데스크탑 콜백
          if (rsp.success) {
            router.push(
              `/deposit/success?imp_uid=${rsp.imp_uid}&merchant_uid=${merchantUid}`
            );
          } else {
            if (preOpenedWin && !preOpenedWin.closed) preOpenedWin.close();
            setErrorMsg(rsp.error_msg ?? '결제가 취소되었습니다.');
            setPayStep('error');
          }
        }
      );
    } catch (e: unknown) {
      // window.open 복원
      (window as Window & { open: typeof window.open }).open = origOpen;
      if (preOpenedWin && !preOpenedWin.closed) preOpenedWin.close();
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
                <p className="text-xs text-white/50 mt-0.5">에스크로 보관 · 본인 귀책 없으면 환불</p>
              </div>
              <span className="text-base font-bold">{DEPOSIT.toLocaleString()}원</span>
            </div>
          </div>
        </div>

        {/* 주요 안내 */}
        <h3 className="text-sm font-bold text-gray-900 mb-3">3회 만남 보장제 안내</h3>
        {[
          { icon: '🤝', title: '3번의 실제 만남을 목표로', desc: '3rd Vibe 매니저가 직접 큐레이션하고 일정을 조율합니다' },
          { icon: '💰', title: '보증금은 에스크로 안전 보관', desc: '결제 즉시 별도 에스크로에 보관 — 임의 사용 절대 불가' },
          { icon: '✅', title: '본인 귀책사유 없으면 보증금 전액 환불', desc: '약속을 지키려 했고 본인 잘못이 없다면, 만남 횟수와 무관하게 보증금을 돌려드립니다' },
          { icon: '🚫', title: '본인 귀책사유 있으면 보증금 반환 불가', desc: '노쇼·일방적 취소·잠수 등 본인 귀책으로 만남이 무산되면 보증금은 몰수됩니다' },
          { icon: '📸', title: '매 만남마다 인증 사진 제출 권장', desc: '장소·날짜가 보이는 사진을 제출하면 만남 사실을 명확히 입증할 수 있습니다' },
          { icon: '🗂️', title: '매칭비는 소멸', desc: '매칭 큐레이션 서비스 비용으로, 어떤 경우에도 환불되지 않습니다' },
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

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4">
          <p className="text-xs font-semibold text-amber-800 mb-1.5">⚠️ 보증금 환불 핵심 원칙</p>
          <p className="text-xs text-amber-700 leading-relaxed">
            보증금(15,000원)은 <strong>본인의 귀책사유 유무</strong>에 따라 환불 여부가 결정됩니다.<br /><br />
            • 약속을 지키려 했고 본인 잘못이 없다면 → <strong>전액 환불</strong><br />
            • 노쇼·일방 취소·잠수 등 본인 귀책이 있다면 → <strong>환불 불가</strong><br /><br />
            귀책사유 판단은 양측 소명을 청취한 후 운영팀이 결정합니다.
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-8">
          <p className="text-xs font-semibold text-gray-700 mb-1.5">📋 귀책사유 해당 항목</p>
          <ul className="text-xs text-gray-500 space-y-1 leading-relaxed list-none">
            <li>· 당일 연락 없는 노쇼</li>
            <li>· 합의 없는 일방적 일정 취소</li>
            <li>· 2회 이상 만남 회피 또는 무응답</li>
            <li>· 허위 인증 사진 제출</li>
            <li>· 서비스 운영 규정 위반</li>
          </ul>
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
          <p className="text-[11px] text-gray-300">SSL 256-bit 암호화 · 포트원 안전결제</p>
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
          포트원 · SSL 256-bit 보안 결제
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
