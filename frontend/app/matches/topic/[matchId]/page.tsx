'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

// ── 타입 ─────────────────────────────────────────────────
interface Topic {
  id: string;
  question: string;
  context: string;  // 이 주제가 왜 뽑혔는지 (두 프로필 공통점 기반)
  emoji: string;
}

// 실제 서비스: 두 유저의 프로필을 비교 분석해 AI가 생성
const MOCK_TOPICS: Topic[] = [
  {
    id: 't1',
    question: '여행 중에 가장 기억에 남는 식당이나 카페가 있나요?',
    context: '두 분 모두 여행과 카페를 좋아하시네요',
    emoji: '☕',
  },
  {
    id: 't2',
    question: '상대방 나라에서 꼭 해보고 싶은 것이 있다면요?',
    context: '크로스보더 만남의 설렘을 직접 나눠보세요',
    emoji: '✈️',
  },
  {
    id: 't3',
    question: '지금 이 순간 듣고 있는 음악이나 좋아하는 플레이리스트를 알려줄 수 있나요?',
    context: 'Yuki님이 음악을 즐기신다고 하셨어요',
    emoji: '🎵',
  },
];

const MATCH_INFO = {
  match_new: { name: 'Yuki', age: 26, flag: '🇯🇵', city: '도쿄', isTruenote: true,
               gradientFrom: '#ede9fe', gradientTo: '#dbeafe' },
  match_001: { name: 'Yuki', age: 26, flag: '🇯🇵', city: '도쿄', isTruenote: true,
               gradientFrom: '#ede9fe', gradientTo: '#dbeafe' },
  match_002: { name: '小雅', age: 24, flag: '🇹🇼', city: '타이베이', isTruenote: true,
               gradientFrom: '#fef3c7', gradientTo: '#fde8d5' },
} as const;

// ── 카운트다운 훅 ─────────────────────────────────────────
function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(targetMs);
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  return { h, m, s, expired: remaining === 0 };
}

// ── 메인 ─────────────────────────────────────────────────
export default function TopicSelectPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.matchId as string;
  const match = MATCH_INFO[matchId as keyof typeof MATCH_INFO] ?? MATCH_INFO['match_new'];

  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showMatch, setShowMatch] = useState(false);

  // 24시간 카운트다운
  const { h, m, s, expired } = useCountdown(24 * 60 * 60 * 1000);

  // 매칭 애니메이션 — 제출 후 1.5초 뒤 "매칭됨!" 표시
  const handleSubmit = () => {
    if (!selected) return;
    setSubmitted(true);
    setTimeout(() => setShowMatch(true), 1500);
  };

  // 채팅 진입
  const goToChat = () => {
    router.replace(`/chat/${matchId === 'match_new' ? 'match_001' : matchId}`);
  };

  // ── 매칭 성공 화면 ────────────────────────────────────
  if (showMatch) {
    const topic = MOCK_TOPICS.find((t) => t.id === selected)!;
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 text-center">
        {/* 매칭 축하 */}
        <div className="relative mb-8">
          <div className="flex items-center gap-4">
            {/* 내 아바타 */}
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl border-2 border-white shadow-sm">
              🙂
            </div>
            {/* 연결 선 */}
            <div className="flex items-center gap-1">
              <div className="w-4 h-px bg-gray-300" />
              <svg className="w-5 h-5 text-[#0f0f0f]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              <div className="w-4 h-px bg-gray-300" />
            </div>
            {/* 상대 아바타 */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl border-2 border-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${match.gradientFrom}, ${match.gradientTo})` }}
            >
              {match.flag}
            </div>
          </div>
          {match.isTruenote && (
            <div className="absolute -bottom-2 right-0 bg-[#0f0f0f] text-white text-[9px] px-2 py-0.5 rounded-full">
              TrueNote ✓
            </div>
          )}
        </div>

        <h2 className="text-2xl font-medium text-gray-900 mb-2 tracking-tight">
          {match.name}님과 매칭됐어요
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed mb-8">
          선택한 주제로 첫 대화를 시작해보세요
        </p>

        {/* 선택된 주제 카드 */}
        <div className="w-full bg-gray-50 rounded-2xl p-5 mb-8 text-left">
          <p className="text-xs text-gray-400 mb-2">첫 번째 주제</p>
          <p className="text-2xl mb-3">{topic.emoji}</p>
          <p className="text-base font-medium text-gray-900 leading-snug">{topic.question}</p>
        </div>

        <button
          onClick={goToChat}
          className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                     active:scale-[0.98] transition-transform"
        >
          대화 시작하기
        </button>
      </div>
    );
  }

  // ── 제출 후 대기 화면 ─────────────────────────────────
  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 text-center gap-5">
        <div className="w-14 h-14 rounded-full border border-gray-200 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
        <div>
          <p className="text-base font-medium text-gray-900 mb-1">주제를 전달했어요</p>
          <p className="text-sm text-gray-400">
            {match.name}님도 주제를 선택하면<br />대화가 열려요
          </p>
        </div>
      </div>
    );
  }

  // ── 주제 선택 메인 화면 ───────────────────────────────
  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen">
      {/* 헤더 */}
      <div className="px-6 pt-14 pb-6 border-b border-gray-100">
        {/* 카운트다운 */}
        <div className="flex items-center gap-2 mb-5">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs text-gray-400 font-mono tabular-nums">
            {expired
              ? '시간 만료'
              : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} 안에 선택해 주세요`}
          </span>
        </div>

        {/* 매칭 상대 정보 */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${match.gradientFrom}, ${match.gradientTo})` }}
          >
            {match.flag}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-900">{match.name}, {match.age}</span>
              {match.isTruenote && (
                <span className="bg-[#0f0f0f] text-white text-[9px] px-1.5 py-0.5 rounded-full">TrueNote</span>
              )}
            </div>
            <p className="text-xs text-gray-400">{match.city}</p>
          </div>
        </div>

        <h1 className="text-xl font-medium text-gray-900 leading-snug tracking-tight">
          어떤 이야기로<br />첫 대화를 시작할까요?
        </h1>
        <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
          두 분의 프로필을 바탕으로 주제를 준비했어요.<br />
          상대방이 선택한 주제는 둘 다 선택 후 공개됩니다.
        </p>
      </div>

      {/* 주제 카드 목록 */}
      <div className="flex-1 px-5 py-5 flex flex-col gap-3 overflow-y-auto">
        {MOCK_TOPICS.map((topic, idx) => (
          <button
            key={topic.id}
            onClick={() => setSelected(topic.id)}
            className={`w-full text-left p-5 rounded-2xl border-[1.5px] transition-all active:scale-[0.98]
              ${selected === topic.id
                ? 'border-[#0f0f0f] bg-[#0f0f0f]'
                : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
          >
            <div className="flex items-start gap-4">
              <span className="text-2xl flex-shrink-0 mt-0.5">{topic.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-snug mb-2
                  ${selected === topic.id ? 'text-white' : 'text-gray-900'}`}>
                  {topic.question}
                </p>
                <p className={`text-xs leading-relaxed
                  ${selected === topic.id ? 'text-white/60' : 'text-gray-400'}`}>
                  {topic.context}
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0 mt-0.5
                ${selected === topic.id
                  ? 'border-white bg-white'
                  : 'border-gray-300'}`}>
                {selected === topic.id && (
                  <svg className="w-3 h-3 text-[#0f0f0f]" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </button>
        ))}

        {/* 안내 */}
        <div className="flex items-start gap-2 px-1 mt-2">
          <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <p className="text-xs text-gray-300 leading-relaxed">
            선택한 주제는 상대방도 선택을 완료한 뒤 서로에게 공개됩니다.
            24시간 내 미선택 시 매칭이 해제됩니다.
          </p>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="px-5 pb-10 pt-3 border-t border-gray-100">
        <button
          onClick={handleSubmit}
          disabled={!selected}
          className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                     disabled:opacity-30 active:scale-[0.98] transition-all"
        >
          이 주제로 시작하기
        </button>
      </div>
    </div>
  );
}
