'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SuccessContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus]     = useState<'loading' | 'done' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // 포트원 V1 파라미터 (모바일 리다이렉트 + 데스크탑 콜백 후 라우팅)
    const impUid      = params.get('imp_uid');
    const merchantUid = params.get('merchant_uid');
    const impSuccess  = params.get('imp_success');

    // 모바일 리다이렉트 실패
    if (impSuccess === 'false') {
      setErrorMsg(params.get('error_msg') ?? '결제가 취소되었습니다.');
      setStatus('error');
      return;
    }

    if (!impUid || !merchantUid) {
      setErrorMsg('결제 정보가 올바르지 않습니다.');
      setStatus('error');
      return;
    }

    fetch('/api/payment/portone-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imp_uid: impUid, merchant_uid: merchantUid }),
    })
      .then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? '결제 검증에 실패했습니다.');
        }
        setStatus('done');
      })
      .catch(e => {
        setErrorMsg(e instanceof Error ? e.message : '결제 처리 중 오류가 발생했습니다.');
        setStatus('error');
      });
  }, [params]);

  if (status === 'loading') return (
    <div className="flex flex-col min-h-screen bg-white items-center justify-center px-6 text-center">
      <svg className="animate-spin w-10 h-10 text-gray-300 mb-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <p className="text-sm text-gray-500">결제 확인 중...</p>
    </div>
  );

  if (status === 'error') return (
    <div className="flex flex-col min-h-screen bg-white items-center justify-center px-6 text-center">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">결제 검증 실패</h2>
      <p className="text-sm text-gray-500 mb-8">{errorMsg}</p>
      <button onClick={() => router.push('/deposit')}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium">
        다시 시도하기
      </button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-white items-center justify-center px-6 text-center">
      <div className="text-5xl mb-5">🎊</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">결제 완료!</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-8">
        3rd Vibe팀이 맞춤 매칭을 시작합니다.<br />
        보통 3~5 영업일 내 첫 매칭을 안내드려요.
      </p>

      <div className="w-full bg-gray-50 rounded-3xl p-5 mb-8 text-left space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">결제 내역</h3>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">매칭비</span>
          <span className="font-medium text-gray-900">15,000원</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">약속 보증금</span>
          <span className="font-medium text-gray-900">15,000원</span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex justify-between text-sm font-bold">
          <span className="text-gray-900">합계</span>
          <span className="text-gray-900">30,000원</span>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 mt-1">
          <p className="text-xs text-blue-600 leading-relaxed">
            🔒 보증금 15,000원은 에스크로 보관 중<br />
            본인 귀책사유 없이 만남이 불발될 경우 7영업일 내 전액 환불됩니다
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
}

export default function DepositSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
