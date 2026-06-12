'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Nationality } from '@/lib/types';
import ProtectedView from '@/components/ProtectedView';
import LikeQuota from '@/components/LikeQuota';

const CURRENT_USER_ID = 'user_abc123';

// Mock 좋아요 할당량 (실제: /api/safety/quota/:userId 에서 fetch)
const MOCK_QUOTA = { used: 3, limit: 5, tier: 'basic' as const, resetAt: new Date(Date.now() + 8 * 3600_000).toISOString() };

// ── 타입 ─────────────────────────────────────────────────
interface Profile {
  id: string;
  name: string;
  age: number;
  nationality: Nationality;
  flag: string;
  city: string;
  job: string;
  tagline: string;           // 한 줄 소개 (Layer 1 히어로 텍스트)
  datingPhilosophy: string;  // 연애관 (Layer 2)
  distanceAttitude: string;  // 장거리에 대한 생각 (Layer 2)
  contactFrequency: string;  // 연락 빈도 기대치 (Layer 2)
  bio: string;               // 자기소개 전문 (Layer 3)
  interests: string[];
  isTruenote: boolean;
  gradientFrom: string;
  gradientTo: string;
}

const PROFILES: Profile[] = [
  {
    id: 'p1', name: 'Yuki', age: 26, nationality: 'JP', flag: '🇯🇵',
    city: '도쿄', job: 'UI 디자이너',
    tagline: '서울의 골목을 함께 걷고 싶어요',
    datingPhilosophy: '서로의 문화를 존중하면서 천천히 가까워지는 관계를 원해요. 처음부터 무겁지 않게, 하지만 진심으로.',
    distanceAttitude: '장거리도 충분히 가능하다고 생각해요. 자주 볼 수 없는 만큼 만날 때 더 특별하니까요.',
    contactFrequency: '하루 1~2번 정도. 서로의 일상을 방해하지 않는 선에서요.',
    bio: '도쿄에서 앱 UI를 디자인하고 있어요. 한국 영화와 음악을 좋아해서 한국어를 독학 중이에요. 제주도와 경주를 꼭 가보고 싶고, 언젠가 서울에서 6개월 정도 살아보고 싶다는 꿈이 있어요. 좋아하는 것들: 오래된 카페, 새벽 산책, 비 오는 날 재즈, 혼자 보는 미술관.',
    interests: ['여행', '카페', '재즈', '미술'],
    isTruenote: true,
    gradientFrom: '#ede9fe', gradientTo: '#dbeafe',
  },
  {
    id: 'p2', name: '小雅', age: 24, nationality: 'TW', flag: '🇹🇼',
    city: '타이베이', job: '브랜드 마케터',
    tagline: '두 나라 사이 어딘가에 우리만의 공간을',
    datingPhilosophy: '연애는 서로를 바꾸는 게 아니라 서로에게 스며드는 것 같아요.',
    distanceAttitude: '거리는 문제가 아니에요. 방향이 같으면 되니까요.',
    contactFrequency: '매일 짧게라도 연락하고 싶어요. 하루를 공유하는 느낌이 좋아요.',
    bio: '타이베이에서 패션 브랜드 마케팅을 하고 있어요. 한국 드라마로 한국어를 공부했고 이제는 꽤 읽고 쓸 수 있어요. 타이베이의 야시장과 서울의 한강이 제가 제일 좋아하는 공간이에요. 요리하는 것도 좋아해서 한식에도 도전 중이에요.',
    interests: ['요리', '야시장', '독서', '한국어'],
    isTruenote: true,
    gradientFrom: '#fef3c7', gradientTo: '#fde8d5',
  },
  {
    id: 'p3', name: 'Haruto', age: 29, nationality: 'JP', flag: '🇯🇵',
    city: '오사카', job: '소프트웨어 엔지니어',
    tagline: '코드처럼 논리적이지만 감정엔 솔직해요',
    datingPhilosophy: '서로의 속도를 존중하는 관계. 급하게 가지 않아도 괜찮아요.',
    distanceAttitude: '오사카-서울은 비행기로 한 시간 반이에요. 가깝다고 생각해요.',
    contactFrequency: '바쁜 날엔 짧은 메시지 하나로도 충분해요. 대신 만날 때 집중하고 싶어요.',
    bio: '오사카에서 핀테크 회사 백엔드 개발자로 일하고 있어요. 한국에 친한 친구들이 있어서 1년에 3~4번은 꼭 방문해요. 혼자 카페에서 책 읽는 걸 좋아하고, 주말엔 자전거로 오사카 구석구석을 돌아다녀요.',
    interests: ['자전거', '독서', '커피', '여행'],
    isTruenote: false,
    gradientFrom: '#d1fae5', gradientTo: '#cffafe',
  },
];

// ── 레이어 진행 인디케이터 ────────────────────────────────
function LayerDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-500
            ${i < current ? 'w-4 h-1.5 bg-[#0f0f0f]' : i === current ? 'w-1.5 h-1.5 bg-[#0f0f0f]' : 'w-1.5 h-1.5 bg-gray-200'}`}
        />
      ))}
      <span className="text-xs text-gray-400 ml-1">
        {current === 0 ? '프로필 시작' : current === 1 ? '연애관' : current >= 2 ? '자기소개' : ''}
      </span>
    </div>
  );
}

// ── TrueNote 배지 ─────────────────────────────────────────
function TruenoteBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-[#0f0f0f] text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
      TrueNote
    </span>
  );
}

// ── 호환성 항목 ───────────────────────────────────────────
function CompatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm text-gray-800 leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

// ── 메인: 홈 페이지 ──────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const layer3Ref = useRef<HTMLDivElement>(null);

  const [profileIdx, setProfileIdx] = useState(0);
  const [layerReached, setLayerReached] = useState(0); // 몇 번째 레이어까지 읽었는지
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [likeAnim, setLikeAnim] = useState(false);

  const profile = PROFILES.filter(
    (p) => !liked.has(p.id) && !passed.has(p.id)
  )[profileIdx] ?? null;

  // 스크롤 감지 → 레이어 도달 여부 추적
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const l2Top = layer2Ref.current?.offsetTop ?? Infinity;
      const l3Top = layer3Ref.current?.offsetTop ?? Infinity;
      const scrollBottom = el.scrollTop + el.clientHeight;

      if (scrollBottom >= l3Top + 60) setLayerReached(3);
      else if (scrollBottom >= l2Top + 60) setLayerReached((p) => Math.max(p, 2));
      else if (el.scrollTop > 20) setLayerReached((p) => Math.max(p, 1));
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [profile?.id]);

  // 프로필 전환 시 리셋
  useEffect(() => {
    setLayerReached(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [profileIdx]);

  const handleLike = () => {
    if (!profile || layerReached < 3) return;
    setLikeAnim(true);
    setTimeout(() => {
      setLikeAnim(false);
      setLiked((p) => new Set(Array.from(p).concat(profile.id)));
      setProfileIdx(0);
      // 매칭됐다고 가정하고 주제 선택으로 이동
      router.push(`/matches/topic/match_new`);
    }, 600);
  };

  const handlePass = () => {
    if (!profile) return;
    setPassed((p) => new Set(Array.from(p).concat(profile.id)));
    setProfileIdx(0);
  };

  if (!profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-white px-8">
        <div className="text-4xl">✨</div>
        <p className="text-base font-medium text-gray-900 text-center">오늘의 프로필을 모두 봤어요</p>
        <p className="text-sm text-gray-400 text-center leading-relaxed">
          내일 새로운 인연이 기다리고 있어요.<br />좋아요를 보낸 분들의 답장을 확인해보세요.
        </p>
        <button
          onClick={() => router.push('/matches')}
          className="mt-2 bg-[#0f0f0f] text-white px-6 py-3 rounded-full text-sm font-medium"
        >
          매칭 확인하기
        </button>
      </div>
    );
  }

  const canLike = layerReached >= 3;

  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen overflow-hidden">

      {/* 상단 바 */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center px-5 pt-14 pb-3
                      bg-gradient-to-b from-white via-white/80 to-transparent">
        <span className="text-lg font-medium text-gray-900 tracking-tight">탐색</span>
        <div className="flex items-center gap-2">
          {/* 잔여 좋아요 미니 뱃지 */}
          <LikeQuota {...MOCK_QUOTA} compact onUpgrade={() => router.push('/subscription')} />
          <button onClick={() => router.push('/matches')} className="relative">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-400" />
          </button>
        </div>
      </div>

      {/* 스크롤 컨테이너 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scroll-smooth"
        style={{ paddingBottom: '120px' }}
      >
        {/* ── LAYER 1: 히어로 ──────────────────────────── */}
        <div ref={layer1Ref} className="relative">
          {/* 배경 그라디언트 + 워터마크 */}
          <ProtectedView userId={CURRENT_USER_ID} watermarkOpacity={0.1}>
          <div
            className="w-full h-[70vh] min-h-[500px] flex flex-col justify-end px-6 pb-8 relative overflow-hidden"
            style={{ background: `linear-gradient(160deg, ${profile.gradientFrom} 0%, ${profile.gradientTo} 100%)` }}
          >
            {/* 아바타 중앙 배치 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-white/40 flex items-center justify-center text-6xl">
                {profile.flag}
              </div>
            </div>

            {/* TrueNote */}
            {profile.isTruenote && (
              <div className="absolute top-20 right-5">
                <TruenoteBadge />
              </div>
            )}

            {/* 히어로 텍스트 */}
            <div className="relative z-10">
              <p className="text-[11px] tracking-widest text-gray-500 uppercase mb-2">
                {profile.city} · {profile.job}
              </p>
              <h2 className="text-3xl font-medium text-gray-900 leading-tight mb-2 tracking-tight">
                {profile.name}, {profile.age}
              </h2>
              <p className="text-base text-gray-700 leading-snug font-light italic">
                "{profile.tagline}"
              </p>
            </div>
          </div>

          </ProtectedView>
          {/* Layer 1 완료 힌트 */}
          <div className="flex flex-col items-center gap-1.5 py-5 border-b border-gray-100">
            <div className="flex flex-col items-center gap-1 animate-bounce">
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="text-xs text-gray-400">스크롤해서 더 알아보기</p>
          </div>
        </div>

        {/* ── LAYER 2: 연애관 & 기대치 ─────────────────── */}
        <div ref={layer2Ref} className="px-6 py-8 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
              <span className="text-white text-[9px] font-medium">2</span>
            </div>
            <p className="text-xs font-medium text-gray-900 tracking-wide uppercase">연애관</p>
          </div>

          <p className="text-base text-gray-800 leading-relaxed mb-6 font-light">
            {profile.datingPhilosophy}
          </p>

          <div className="bg-gray-50 rounded-2xl px-4 py-1">
            <CompatRow
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5" />
                </svg>
              }
              label="장거리 연애에 대해"
              value={profile.distanceAttitude}
            />
            <CompatRow
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337" />
                </svg>
              }
              label="연락 빈도 기대치"
              value={profile.contactFrequency}
            />
          </div>
        </div>

        {/* ── LAYER 3: 자기소개 전문 ───────────────────── */}
        <div ref={layer3Ref} className="px-6 py-8">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
              <span className="text-white text-[9px] font-medium">3</span>
            </div>
            <p className="text-xs font-medium text-gray-900 tracking-wide uppercase">자기소개</p>
          </div>

          <p className="text-base text-gray-700 leading-relaxed font-light mb-6">
            {profile.bio}
          </p>

          {/* 관심사 */}
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((i) => (
              <span key={i}
                className="text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                {i}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 하단 고정: 레이어 진행 + 액션 버튼 ─────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="mx-auto max-w-sm">
          {/* 진행 상태 */}
          <div className="flex justify-center px-6 pb-2 pt-1 bg-white/90 backdrop-blur-sm">
            <LayerDots current={layerReached} total={3} />
          </div>

          <div className="flex items-center gap-3 px-5 pb-8 pt-3 bg-white border-t border-gray-100">
            {/* 패스 버튼 */}
            <button
              onClick={handlePass}
              className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center
                         text-gray-400 active:scale-95 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 좋아요 버튼 — 3레이어 읽기 전 잠김 */}
            <button
              onClick={handleLike}
              disabled={!canLike}
              className={`flex-1 py-3.5 rounded-2xl text-sm font-medium flex items-center justify-center gap-2
                          transition-all duration-500
                ${canLike
                  ? `bg-[#0f0f0f] text-white active:scale-[0.98] ${likeAnim ? 'scale-105' : ''}`
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
            >
              {canLike ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                  {profile.name}에게 좋아요
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  자기소개까지 읽으면 활성화돼요
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 하단 네비 공간 확보용 */}
      <div className="h-20" />
    </div>
  );
}
