'use client';

import { useRouter } from 'next/navigation';

const FILTERS = ['전체', '🇯🇵 일본', '🇹🇼 대만', '🇰🇷 한국'];

const MOCK_USERS = [
  { id: 'u1', name: 'Hana', age: 25, flag: '🇯🇵', city: '도쿄', isTruenote: true,
    bio: '여행과 커피를 사랑해요. 한국 드라마 팬이에요 😊',
    gradientFrom: '#ede9fe', gradientTo: '#dbeafe', interests: ['여행', '커피', '드라마'] },
  { id: 'u2', name: '晴美', age: 23, flag: '🇹🇼', city: '타이베이', isTruenote: true,
    bio: '韓語學習中！좋아하는 한국 음식은 삼겹살이에요.',
    gradientFrom: '#fef3c7', gradientTo: '#fde8d5', interests: ['한국어', '음식', '음악'] },
  { id: 'u3', name: 'Riku', age: 28, flag: '🇯🇵', city: '오사카', isTruenote: false,
    bio: '사진 찍는 걸 좋아해요. 한국 여행 자주 가요!',
    gradientFrom: '#d1fae5', gradientTo: '#dbeafe', interests: ['사진', '여행', '카페'] },
  { id: 'u4', name: '依玲', age: 26, flag: '🇹🇼', city: '타이중', isTruenote: true,
    bio: 'K-pop 덕후예요. BTS 좋아해요 💜',
    gradientFrom: '#fce7f3', gradientTo: '#ede9fe', interests: ['K-pop', '댄스', '영화'] },
];

export default function ExplorePage() {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen">
      {/* 헤더 */}
      <div className="px-6 pt-14 pb-4">
        <h1 className="text-xl font-medium text-gray-900">탐색</h1>
        <p className="text-sm text-gray-400 mt-0.5">근처의 새로운 인연을 만나보세요</p>
      </div>

      {/* 검색바 */}
      <div className="px-5 mb-4">
        <div className="flex items-center gap-2.5 bg-gray-50 rounded-2xl px-4 py-3">
          <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
          </svg>
          <input
            type="text"
            placeholder="이름, 도시, 관심사 검색"
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-300 outline-none"
          />
        </div>
      </div>

      {/* 국가 필터 */}
      <div className="px-5 mb-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map((f, i) => (
            <button
              key={f}
              className={`flex-shrink-0 text-xs px-3.5 py-2 rounded-full border transition-colors
                ${i === 0
                  ? 'bg-[#0f0f0f] text-white border-[#0f0f0f]'
                  : 'bg-white text-gray-500 border-gray-200'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 유저 그리드 */}
      <div className="px-5 grid grid-cols-2 gap-3 overflow-y-auto pb-4">
        {MOCK_USERS.map((u) => (
          <button
            key={u.id}
            onClick={() => router.push('/home')}
            className="text-left rounded-3xl overflow-hidden border border-gray-100 active:scale-[0.97] transition-transform"
          >
            {/* 아바타 영역 */}
            <div
              className="h-36 flex items-center justify-center text-5xl"
              style={{ background: `linear-gradient(135deg, ${u.gradientFrom}, ${u.gradientTo})` }}
            >
              {u.flag}
            </div>

            {/* 정보 */}
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm font-medium text-gray-900">{u.name}, {u.age}</span>
                {u.isTruenote && (
                  <span className="bg-[#0f0f0f] text-white text-[8px] px-1.5 py-0.5 rounded-full leading-none">
                    ✓
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-2">{u.city}</p>
              <div className="flex flex-wrap gap-1">
                {u.interests.slice(0, 2).map((tag) => (
                  <span key={tag}
                    className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
