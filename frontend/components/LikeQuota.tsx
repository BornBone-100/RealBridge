'use client';

/**
 * LikeQuota — 오늘 남은 좋아요 횟수 표시 컴포넌트
 * ==================================================
 * UX 원칙:
 * - 희소성 원칙(Scarcity): 잔여 횟수가 줄수록 게이지 색이 바뀜
 * - 부채 효과(Endowment): "남은" 횟수 표현으로 손실 회피 심리 자극
 * - 자정 리셋 카운트다운: 언제 충전되는지 알면 앱 재방문율 상승
 */

import { useEffect, useState } from 'react';

interface LikeQuotaProps {
  used:       number;
  limit:      number;
  tier:       'basic' | 'truenote' | 'staff';
  resetAt:    string;   // ISO8601
  onUpgrade?: () => void;
  compact?:   boolean;  // 좁은 공간용 (홈 헤더 등)
}

function useCountdownToReset(resetAt: string) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const calc = () => {
      const diff = new Date(resetAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('곧 충전'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setRemaining(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} 후 충전`);
    };
    calc();
    const t = setInterval(calc, 60_000);
    return () => clearInterval(t);
  }, [resetAt]);

  return remaining;
}

export default function LikeQuota({
  used, limit, tier, resetAt, onUpgrade, compact = false,
}: LikeQuotaProps) {
  const remaining   = Math.max(0, limit - used);
  const pct         = limit > 0 ? (remaining / limit) * 100 : 0;
  const countdown   = useCountdownToReset(resetAt);
  const isLow       = remaining <= Math.ceil(limit * 0.3);   // 30% 이하
  const isEmpty     = remaining === 0;

  // 잔여 비율에 따른 게이지 색상
  const barColor = isEmpty
    ? 'bg-gray-200'
    : isLow
      ? 'bg-amber-400'
      : 'bg-[#0f0f0f]';

  if (compact) {
    // 홈 헤더용 미니 뱃지
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-colors
        ${isEmpty ? 'bg-gray-50 border-gray-200' : isLow ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
        <svg className={`w-3.5 h-3.5 ${isEmpty ? 'text-gray-300' : isLow ? 'text-amber-500' : 'text-gray-700'}`}
          fill={isEmpty ? 'none' : 'currentColor'} viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={isEmpty ? 2 : 0}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
        <span className={`text-xs font-medium tabular-nums
          ${isEmpty ? 'text-gray-300' : isLow ? 'text-amber-600' : 'text-gray-700'}`}>
          {remaining}/{limit}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 px-5 py-4 flex flex-col gap-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">
            {isEmpty ? '🔒' : isLow ? '⚡' : '❤️'}
          </span>
          <p className="text-sm font-medium text-gray-900">오늘의 좋아요</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-2xl font-medium tabular-nums
            ${isEmpty ? 'text-gray-300' : isLow ? 'text-amber-500' : 'text-gray-900'}`}>
            {remaining}
          </span>
          <span className="text-xs text-gray-300">/ {limit}</span>
        </div>
      </div>

      {/* 게이지 바 */}
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 하단 정보 */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-400">{countdown}</span>

        {/* 베이직 유저에게 업그레이드 유도 */}
        {tier === 'basic' && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="flex items-center gap-1 text-[11px] text-gray-500 border border-gray-200
                       rounded-full px-2.5 py-1 active:bg-gray-50 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
            TrueNote로 15회
          </button>
        )}

        {tier === 'truenote' && (
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <span className="bg-[#0f0f0f] text-white text-[8px] px-1.5 py-0.5 rounded-full">TrueNote</span>
            프리미엄 혜택
          </span>
        )}
      </div>

      {/* 빈 상태 메시지 */}
      {isEmpty && (
        <div className="bg-gray-50 rounded-2xl px-4 py-3 text-center">
          <p className="text-xs text-gray-500 leading-relaxed">
            오늘의 좋아요를 모두 사용했어요.<br />
            <span className="text-gray-400">{countdown}에 다시 충전됩니다</span>
          </p>
          {tier === 'basic' && onUpgrade && (
            <button
              onClick={onUpgrade}
              className="mt-2 text-xs text-[#0f0f0f] font-medium underline underline-offset-2"
            >
              TrueNote로 하루 15회 사용하기 →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
