'use client';

import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { signOut } from '@/lib/supabase';

const MENU_ITEMS = [
  { icon: '🔔', label: '알림 설정' },
  { icon: '🔒', label: '개인정보 보호' },
  { icon: '💳', label: '구독 관리', sub: 'TrueNote', href: '/subscription' },
  { icon: '📋', label: '이용약관' },
  { icon: '🛡️', label: '안전 가이드' },
];

const GRADIENTS = [
  { from: '#dbeafe', to: '#ede9fe' },
  { from: '#d1fae5', to: '#cffafe' },
  { from: '#fce7f3', to: '#fef3c7' },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading } = useCurrentUser();

  const age = profile?.birth_year ? new Date().getFullYear() - profile.birth_year : null;
  const gradient = GRADIENTS[0];

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
        <p className="text-base font-medium text-gray-900">로그인이 필요합니다</p>
        <button onClick={() => router.push('/onboarding')}
          className="bg-[#0f0f0f] text-white px-6 py-3 rounded-full text-sm font-medium">
          가입/로그인
        </button>
      </div>
    );
  }

  const displayName = profile?.name ?? '이름 없음';
  const displayJob = profile?.occupation ?? '';
  const displayDistrict = profile?.district ? `부산 ${profile.district}` : '부산';
  const displayBio = profile?.bio ?? '자기소개를 작성해 주세요.';
  const interests = profile?.hobbies ?? [];
  const isVerified = profile?.verification_status === 'approved';

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
            className="h-28 flex items-center justify-center text-5xl font-medium text-gray-600"
            style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
          >
            {displayName.slice(0, 1)}
          </div>

          <div className="px-5 py-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-medium text-gray-900">
                    {displayName}{age ? `, ${age}` : ''}
                  </h2>
                  {isVerified && (
                    <span className="bg-[#0f0f0f] text-white text-[9px] px-2 py-0.5 rounded-full">
                      인증 ✓
                    </span>
                  )}
                  {profile?.mbti && (
                    <span className="bg-gray-100 text-gray-600 text-[9px] px-2 py-0.5 rounded-full">
                      {profile.mbti}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-0.5">
                  {displayDistrict}{displayJob ? ` · ${displayJob}` : ''}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-3">{displayBio}</p>

            {interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {interests.map((tag) => (
                  <span key={tag}
                    className="text-xs bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 전화번호 표시 */}
      <div className="px-5 mb-5">
        <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-gray-500">📱</span>
          <div>
            <p className="text-xs text-gray-400">인증된 전화번호</p>
            <p className="text-sm text-gray-700 mt-0.5">{user.phone ?? '-'}</p>
          </div>
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

        {/* 카카오톡 채널 문의하기 */}
        {process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL && (
          <a
            href={process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 mt-4 mb-1
                       bg-[#FEE500] text-[#3A1D1D] rounded-2xl py-3.5 text-sm font-semibold
                       active:opacity-80 transition-opacity"
          >
            <span className="text-base">💬</span>
            카카오톡으로 문의하기
          </a>
        )}

        {/* 로그아웃 */}
        <button
          onClick={handleSignOut}
          className="w-full text-center text-sm text-gray-300 py-5 mt-1">
          로그아웃
        </button>
      </div>
    </div>
  );
}
