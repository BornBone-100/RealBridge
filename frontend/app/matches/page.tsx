'use client';

import { useRouter } from 'next/navigation';

interface Match {
  id: string;
  name: string;
  age: number;
  flag: string;
  city: string;
  isTruenote: boolean;
  lastMessage: string;
  lastTime: string;
  unread: number;
  gradientFrom: string;
  gradientTo: string;
}

const MOCK_MATCHES: Match[] = [
  {
    id: 'match_001',
    name: 'Yuki', age: 26, flag: '🇯🇵', city: '도쿄',
    isTruenote: true,
    lastMessage: '안녕하세요! 반가워요 😊',
    lastTime: '방금',
    unread: 2,
    gradientFrom: '#e8d5f5', gradientTo: '#d5e8f5',
  },
  {
    id: 'match_002',
    name: '小雅', age: 24, flag: '🇹🇼', city: '타이베이',
    isTruenote: true,
    lastMessage: '한국 음식 중에 뭘 제일 좋아해요?',
    lastTime: '1시간',
    unread: 0,
    gradientFrom: '#fde8d5', gradientTo: '#f5e8d5',
  },
  {
    id: 'match_003',
    name: 'Haruto', age: 29, flag: '🇯🇵', city: '오사카',
    isTruenote: false,
    lastMessage: '주말에 뭐 하세요?',
    lastTime: '어제',
    unread: 1,
    gradientFrom: '#d5f5e8', gradientTo: '#d5f0f5',
  },
];

export default function MatchesPage() {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen">
      {/* 헤더 */}
      <div className="px-6 pt-14 pb-4">
        <h1 className="text-xl font-medium text-gray-900">매칭</h1>
        <p className="text-sm text-gray-400 mt-0.5">{MOCK_MATCHES.length}명과 연결됨</p>
      </div>

      {/* 새로운 매칭 가로 스크롤 */}
      <div className="px-6 mb-5">
        <p className="text-xs text-gray-400 mb-3">새로운 매칭</p>
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {MOCK_MATCHES.map((m) => (
            <button
              key={m.id}
              onClick={() => router.push(`/chat/${m.id}`)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              {/* 아바타 */}
              <div className="relative">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 border-white"
                  style={{ background: `linear-gradient(135deg, ${m.gradientFrom}, ${m.gradientTo})` }}
                >
                  {m.flag}
                </div>
                {m.isTruenote && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#0f0f0f]
                                  flex items-center justify-center border-2 border-white">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                )}
                {m.unread > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500
                                  flex items-center justify-center border border-white">
                    <span className="text-white text-[9px] font-medium">{m.unread}</span>
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-600">{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 구분선 */}
      <div className="h-px bg-gray-100 mx-6 mb-2" />

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto">
        <p className="text-xs text-gray-400 px-6 py-3">메시지</p>
        {MOCK_MATCHES.map((m) => (
          <button
            key={m.id}
            onClick={() => router.push(`/chat/${m.id}`)}
            className="w-full flex items-center gap-3 px-6 py-3.5 active:bg-gray-50 transition-colors"
          >
            {/* 아바타 */}
            <div className="relative flex-shrink-0">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                style={{ background: `linear-gradient(135deg, ${m.gradientFrom}, ${m.gradientTo})` }}
              >
                {m.flag}
              </div>
              {m.isTruenote && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0f0f0f]
                                flex items-center justify-center border border-white">
                  <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
              )}
            </div>

            {/* 텍스트 */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-baseline justify-between mb-0.5">
                <span className={`text-sm ${m.unread > 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                  {m.name}, {m.age}
                </span>
                <span className="text-xs text-gray-300 flex-shrink-0 ml-2">{m.lastTime}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-xs truncate ${m.unread > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
                  {m.lastMessage}
                </p>
                {m.unread > 0 && (
                  <div className="w-4 h-4 rounded-full bg-[#0f0f0f] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[9px] font-medium">{m.unread}</span>
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
