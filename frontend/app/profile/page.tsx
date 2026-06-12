'use client';

import { useRouter } from 'next/navigation';

const MOCK_ME = {
  name: '김민준',
  age: 27,
  flag: '🇰🇷',
  city: '서울',
  job: '소프트웨어 엔지니어',
  bio: '일본과 대만 문화에 관심이 많아요. 여행을 즐기고 새로운 음식을 탐험하는 걸 좋아합니다.',
  interests: ['여행', '카페', '음악', '요리', '독서'],
  isTruenote: true,
  gradientFrom: '#dbeafe',
  gradientTo: '#ede9fe',
};

const MENU_ITEMS = [
  { icon: '🔔', label: '알림 설정' },
  { icon: '🌐', label: '언어 설정', sub: '한국어' },
  { icon: '🔒', label: '개인정보 보호' },
  { icon: '💳', label: '구독 관리', sub: 'TrueNote', href: '/subscription' },
  { icon: '📋', label: '이용약관' },
  { icon: '🛡️', label: '안전 가이드' },
];

export default function ProfilePage() {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen">
      {/* 헤더 */}
      <div className="px-6 pt-14 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-medium text-gray-900">프로필</h1>
        <button
          onClick={() => router.push('/profile/setup')}
          className="text-xs text-gray-400 border border-gray-200 rounded-full px-3 py-1.5"
        >
          편집
        </button>
      </div>

      {/* 프로필 카드 */}
      <div className="px-5 mb-5">
        <div className="rounded-3xl overflow-hidden border border-gray-100">
          {/* 커버 그라디언트 */}
          <div
            className="h-28 flex items-center justify-center text-6xl"
            style={{ background: `linear-gradient(135deg, ${MOCK_ME.gradientFrom}, ${MOCK_ME.gradientTo})` }}
          >
            {MOCK_ME.flag}
          </div>

          <div className="px-5 py-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-medium text-gray-900">
                    {MOCK_ME.name}, {MOCK_ME.age}
                  </h2>
                  {MOCK_ME.isTruenote && (
                    <span className="bg-[#0f0f0f] text-white text-[9px] px-2 py-0.5 rounded-full">
                      TrueNote ✓
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-0.5">{MOCK_ME.city} · {MOCK_ME.job}</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-3">{MOCK_ME.bio}</p>

            <div className="flex flex-wrap gap-1.5">
              {MOCK_ME.interests.map((tag) => (
                <span key={tag}
                  className="text-xs bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 통계 */}
      <div className="px-5 mb-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '받은 좋아요', value: '24' },
            { label: '매칭', value: '3' },
            { label: '프로필 조회', value: '156' },
          ].map((stat) => (
            <div key={stat.label}
              className="bg-gray-50 rounded-2xl px-3 py-3.5 text-center">
              <p className="text-xl font-medium text-gray-900 mb-0.5">{stat.value}</p>
              <p className="text-[10px] text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 메뉴 */}
      <div className="px-5 flex-1">
        <div className="rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => item.href && router.push(item.href)}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition-colors"
            >
              <span className="text-lg w-6 text-center">{item.icon}</span>
              <span className="flex-1 text-sm text-gray-700 text-left">{item.label}</span>
              {item.sub && (
                <span className="text-xs text-gray-400 mr-1">{item.sub}</span>
              )}
              <svg className="w-4 h-4 text-gray-200" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>

        {/* 로그아웃 */}
        <button className="w-full text-center text-sm text-gray-300 py-5 mt-2">
          로그아웃
        </button>
      </div>
    </div>
  );
}
