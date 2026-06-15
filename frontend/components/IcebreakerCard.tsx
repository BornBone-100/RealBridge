'use client';

import { useState, useEffect } from 'react';

const CARDS = [
  { q: '가장 좋아하는 부산 야경 스팟은 어디인가요? 🌃', category: 'busan' },
  { q: '광안리 vs 해운대, 어느 쪽을 더 좋아하세요?', category: 'busan' },
  { q: '서면에서 자주 가는 맛집이 있다면 추천해 주세요! 🍜', category: 'busan' },
  { q: '감천문화마을과 흰여울 중 데이트 코스로 어디가 더 좋을까요?', category: 'busan' },
  { q: '부산에서 꼭 가봐야 할 숨은 카페를 알고 계신가요? ☕', category: 'busan' },
  { q: '연락 빈도는 어느 정도가 딱 좋다고 생각하세요?', category: 'relationship' },
  { q: '첫 데이트 장소로 가장 설레는 곳은 어디인가요?', category: 'relationship' },
  { q: '연애에서 가장 중요하게 생각하는 것은 무엇인가요?', category: 'relationship' },
  { q: '내가 생각하는 완벽한 주말 데이트 코스를 소개해 주세요 😊', category: 'relationship' },
  { q: '무인도에 딱 한 가지만 가져간다면 무엇을 선택하시겠어요?', category: 'fun' },
  { q: '나만의 특이한 음식 취향이 있다면?', category: 'fun' },
  { q: '지금 당장 여행을 떠난다면 어디로 가고 싶으세요?', category: 'fun' },
  { q: '주말 아침에 눈을 뜨면 가장 먼저 하고 싶은 일은?', category: 'general' },
  { q: '요즘 가장 빠져 있는 취미나 관심사는 무엇인가요?', category: 'general' },
];

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  busan:        { label: '🌊 부산 특화',   color: 'text-blue-600',   bg: 'bg-blue-50'   },
  relationship: { label: '💕 연애 가치관', color: 'text-rose-600',   bg: 'bg-rose-50'   },
  fun:          { label: '😄 재미 질문',   color: 'text-amber-600',  bg: 'bg-amber-50'  },
  general:      { label: '💬 일상 이야기', color: 'text-green-600',  bg: 'bg-green-50'  },
};

interface Props {
  onClose: () => void;
  onSendAsMessage?: (text: string) => void;
}

export default function IcebreakerCard({ onClose, onSendAsMessage }: Props) {
  const [current, setCurrent] = useState(() => Math.floor(Math.random() * CARDS.length));
  const [animating, setAnimating] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(new Set([current]));

  const card = CARDS[current];
  const meta = CATEGORY_META[card.category];

  const nextCard = () => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      let next = current;
      let attempts = 0;
      do {
        next = Math.floor(Math.random() * CARDS.length);
        attempts++;
      } while (seen.has(next) && attempts < CARDS.length);

      if (attempts >= CARDS.length) setSeen(new Set());
      setCurrent(next);
      setSeen(s => new Set(Array.from(s).concat(next)));
      setAnimating(false);
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`w-full max-w-sm transition-all duration-200 ${animating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        {/* 카드 */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* 상단 카테고리 배너 */}
          <div className={`${meta.bg} px-5 py-3 flex items-center justify-between`}>
            <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
            <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 질문 */}
          <div className="px-6 py-8 text-center">
            <div className="text-4xl mb-4">🃏</div>
            <p className="text-base font-medium text-gray-900 leading-relaxed">{card.q}</p>
          </div>

          {/* 하단 버튼 */}
          <div className="px-5 pb-5 flex flex-col gap-2">
            {onSendAsMessage && (
              <button onClick={() => { onSendAsMessage(card.q); onClose(); }}
                className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3 text-sm font-medium
                           active:scale-[0.98] transition-all">
                이 질문을 채팅으로 보내기 💬
              </button>
            )}
            <button onClick={nextCard}
              className="w-full bg-gray-50 text-gray-700 rounded-2xl py-3 text-sm
                         active:scale-[0.98] transition-all border border-gray-100">
              다른 질문 뽑기 🔀
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-white/60 mt-3">
          {seen.size} / {CARDS.length} 질문 확인
        </p>
      </div>
    </div>
  );
}
