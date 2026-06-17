'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function FailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const errorCode = params.get('code') ?? '';
  const errorMsg  = params.get('message') ?? '결제가 취소되었거나 오류가 발생했습니다.';

  return (
    <div className="flex flex-col min-h-screen bg-white items-center justify-center px-6 text-center">
      <div className="text-4xl mb-4">😞</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">결제 실패</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-2">{errorMsg}</p>
      {errorCode && (
        <p className="text-xs text-gray-300 mb-8">오류 코드: {errorCode}</p>
      )}
      {!errorCode && <div className="mb-8" />}

      <div className="w-full space-y-3">
        <button onClick={() => router.push('/deposit')}
          className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-semibold
                     active:scale-[0.98] transition-all">
          다시 시도하기
        </button>
        <button onClick={() => router.push('/home')}
          className="w-full border border-gray-200 text-gray-600 rounded-2xl py-3.5 text-sm
                     active:bg-gray-50 transition-all">
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}

export default function DepositFailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
      </div>
    }>
      <FailContent />
    </Suspense>
  );
}
