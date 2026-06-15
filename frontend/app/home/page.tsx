'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedView from '@/components/ProtectedView';
import LikeQuota from '@/components/LikeQuota';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getClient } from '@/lib/supabase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── 활성 매치 잠금 상태 타입 ─────────────────────────────────
interface ActiveMatch {
  match_id: string;
  state: string;
  meetings_done: number;
  meetings_remaining: number;
  matched_at: string;
  partner_id: string;
}

// ── 매칭 잠금 배너 컴포넌트 ──────────────────────────────────
function MatchLockBanner({ match, onGoToMatch }: { match: ActiveMatch; onGoToMatch: () => void }) {
  const dots = Array.from({ length: 3 }).map((_, i) => i < match.meetings_done);
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24 bg-white">
      {/* 상태 카드 */}
      <div className="w-full max-w-sm bg-[#0f0f0f] rounded-3xl p-7 text-white text-center mb-6">
        <div className="text-4xl mb-4">💑</div>
        <h2 className="text-xl font-semibold mb-2">매칭 진행 중</h2>
        <p className="text-sm text-white/70 leading-relaxed mb-6">
          현재 진행 중인 만남이 있어요.<br />
          3번의 만남이 완료되거나 매칭이 종료된 후<br />새로운 인연을 찾을 수 있어요.
        </p>

        {/* 3회 만남 진행 도트 */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {dots.map((done, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2
                ${done ? 'bg-white text-[#0f0f0f] border-white' : 'border-white/30 text-white/40'}`}>
                {done ? '✓' : i + 1}
              </div>
              <span className="text-[10px] text-white/50">{i + 1}번째</span>
            </div>
          ))}
        </div>

        <p className="text-sm text-white/60">
          {match.meetings_remaining > 0
            ? `앞으로 ${match.meetings_remaining}번의 만남이 남았어요`
            : '3번의 만남이 완료됐어요! 🎉'}
        </p>
      </div>

      {/* 현재 매칭 보러가기 버튼 */}
      <button
        onClick={onGoToMatch}
        className="w-full max-w-sm bg-[#0f0f0f] text-white py-4 rounded-2xl text-sm font-medium mb-3"
      >
        현재 매칭 보러가기 →
      </button>
      <p className="text-xs text-gray-400 text-center leading-relaxed">
        3rd Vibe는 한 번에 한 사람과의 진심을 믿어요.<br />
        한 커플에 집중하는 프리미엄 매칭 서비스입니다.
      </p>
    </div>
  );
}

interface Quota {
  used: number;
  limit: number;
  tier: 'basic' | 'premium';
  resetAt: string;
}

// ── 타입 ─────────────────────────────────────────────────
interface Profile {
  id: string;
  name: string;
  age: number;
  district: string;   // 활동 구 (수영구, 해운대구 등)
  job: string;
  mbti: string;
  tagline: string;          // 한 줄 소개 (Layer 1)
  datingPhilosophy: string; // 연애관 (Layer 2)
  busanFavorite: string;    // 부산에서 좋아하는 곳/것 (Layer 2)
  contactFrequency: string; // 연락 빈도 (Layer 2)
  bio: string;              // 자기소개 전문 (Layer 3)
  interests: string[];
  isTruenote: boolean;
  gradientFrom: string;
  gradientTo: string;
  emoji: string;            // 아바타 이모지
}

const PROFILES: Profile[] = [
  {
    id: 'p1', name: '지수', age: 26,
    district: '수영구', job: 'UX 디자이너', mbti: 'INFJ',
    emoji: '🌊',
    tagline: '광안대교 야경 보면서 맥주 한 캔 어때요',
    datingPhilosophy: '서두르지 않아도 괜찮아요. 천천히 서로를 알아가면서 진심이 쌓이는 게 좋더라고요. 가벼운 만남보다는 오래 함께할 수 있는 사람을 찾아요.',
    busanFavorite: '수영구 골목 카페투어 🍵 — 광안리 해변 새벽 산책이 제 최애 코스예요.',
    contactFrequency: '하루 1~2번 정도. 서로의 일상을 방해하지 않는 선에서 소소하게 연락하고 싶어요.',
    bio: '부산에서 나고 자란 토박이예요. 낮에는 화면 디자인하고, 퇴근 후엔 광안리 근처를 어슬렁거리는 게 루틴이에요. 부산 바다가 세상에서 제일 예쁘다고 생각하고, 그 이유 하나로 서울 취업 제안 거절하고 남았어요. 함께 부산 맛집 탐방하고, 영화 보고, 사소한 것들로 웃을 수 있는 사람 만나고 싶어요.',
    interests: ['카페투어', '영화', '바다', '드라이브'],
    isTruenote: true,
    gradientFrom: '#dbeafe', gradientTo: '#ede9fe',
  },
  {
    id: 'p2', name: '민준', age: 29,
    district: '해운대구', job: '회사원 (IT)', mbti: 'ENTP',
    emoji: '🏄',
    tagline: '해운대 주민인데 정작 바다는 잘 안 가요',
    datingPhilosophy: '연애는 일상이 겹치는 것 같아요. 특별한 날보다 평범한 날을 같이 보낼 수 있는 사람이 좋아요.',
    busanFavorite: '센텀 야경 드라이브 🚗 — 벡스코 앞 카페거리에서 노트북 펴는 것도 좋아해요.',
    contactFrequency: '바쁜 날엔 짧게라도 안부 나누고, 여유 있을 때 길게 얘기해요.',
    bio: '해운대 토박이인데 정작 모래사장은 1년에 두 번 갈까 말까예요. 주중엔 IT 회사 다니고 주말엔 드라이브 다니거나 카페에서 책 읽어요. 부산 사람들이 서울 사람들보다 정 많다는 거 진짜인 것 같아요. 같이 동백섬 산책하고 싶어요.',
    interests: ['드라이브', '독서', '맛집', '테니스'],
    isTruenote: true,
    gradientFrom: '#d1fae5', gradientTo: '#cffafe',
  },
  {
    id: 'p3', name: '예린', age: 25,
    district: '남구', job: '간호사', mbti: 'ISFJ',
    emoji: '🌸',
    tagline: '이기대 야경 보고 싶은데 같이 갈 사람 없어요',
    datingPhilosophy: '솔직하고 따뜻한 사람이 좋아요. 화려하지 않아도 진심으로 대해주는 사람.',
    busanFavorite: '용호동 이기대 공원 🌿 — 남구에 숨은 뷰 맛집 많아요. 제가 안내해드릴게요.',
    contactFrequency: '매일 연락하는 걸 좋아해요. 짧아도 괜찮아요, 생각난다는 게 중요하니까요.',
    bio: '부산대병원 근처에서 일하고 있어요. 교대 근무라 주말이 불규칙하지만, 쉬는 날엔 꼭 밖으로 나가요. 남구에 이렇게 예쁜 곳이 많은데 혼자 다니기 아쉬웠거든요. 흰여울 문화마을이랑 이기대는 꼭 같이 가고 싶어요. 저 부산 맛집 진짜 많이 알아요.',
    interests: ['등산', '카페', '요리', '사진'],
    isTruenote: false,
    gradientFrom: '#fce7f3', gradientTo: '#fef3c7',
  },
  {
    id: 'p4', name: '태양', age: 28,
    district: '부산진구', job: '자영업 (카페 운영)', mbti: 'ESTP',
    emoji: '☕',
    tagline: '서면 카페 사장인데 손님으로 와주실 분',
    datingPhilosophy: '같이 있을 때 편한 사람이 최고예요. 웃음이 많고 솔직한 사람이면 충분해요.',
    busanFavorite: '서면 골목 야식 투어 🍜 — 부산 사람이면 밤 11시 돼지국밥은 당연하죠.',
    contactFrequency: '카페 운영하다 보니 낮엔 바빠요. 저녁에 여유롭게 얘기해요.',
    bio: '서면에서 작은 카페 운영한 지 2년 됐어요. 커피 로스팅부터 직접 해요. 카페 일 마치고 혼자 맥주 한 캔 들고 광안리 나가는 게 낙이었는데, 그 맥주 같이 마실 사람 찾고 있어요. 부산 야식 코스는 저한테 맡겨주세요. 보수동 책방골목도 좋아해요.',
    interests: ['커피', '야식', '독서', '바다'],
    isTruenote: true,
    gradientFrom: '#fef3c7', gradientTo: '#fde8d5',
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
  const { user, loading: authLoading } = useCurrentUser();
  const scrollRef = useRef<HTMLDivElement>(null);
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const layer3Ref = useRef<HTMLDivElement>(null);

  const [profileIdx, setProfileIdx] = useState(0);
  const [layerReached, setLayerReached] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [likeAnim, setLikeAnim] = useState(false);

  // ── Quota ────────────────────────────────────────────
  const [quota, setQuota] = useState<Quota>({
    used: 0, limit: 5, tier: 'basic',
    resetAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
  });

  // ── Exclusive Match Lock ──────────────────────────────
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);
  const [lockLoading, setLockLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLockLoading(false);
      return;
    }

    const checkLock = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/matching/lock-status/${user.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.locked) setActiveMatch(data.match);
        }
      } catch {
        // 서버 미연결 시 무시
      } finally {
        setLockLoading(false);
      }
    };

    // 좋아요 할당량 조회
    const loadQuota = async () => {
      const supabase = getClient();
      const { data } = await supabase
        .from('like_quotas')
        .select('used, daily_limit, reset_at')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setQuota({
          used: data.used ?? 0,
          limit: data.daily_limit ?? 5,
          tier: 'basic',
          resetAt: data.reset_at ?? new Date(Date.now() + 8 * 3600_000).toISOString(),
        });
      }
    };

    checkLock();
    loadQuota();
  }, [user, authLoading]);

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

  // 로딩 중
  if (authLoading || lockLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
      </div>
    );
  }

  // 현재 매칭 진행 중 → 탐색 피드 잠금
  if (activeMatch) {
    return (
      <div className="flex-1 flex flex-col bg-white min-h-screen">
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center px-5 pt-14 pb-3
                        bg-gradient-to-b from-white via-white/80 to-transparent">
          <span className="text-lg font-medium text-gray-900 tracking-tight">탐색</span>
        </div>
        <div className="pt-24">
          <MatchLockBanner
            match={activeMatch}
            onGoToMatch={() => router.push(`/chat/${activeMatch.match_id}`)}
          />
        </div>
      </div>
    );
  }

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
          <LikeQuota {...quota} compact onUpgrade={() => router.push('/subscription')} />
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
          <ProtectedView userId={user?.id ?? ''} watermarkOpacity={0.1}>
          <div
            className="w-full h-[70vh] min-h-[500px] flex flex-col justify-end px-6 pb-8 relative overflow-hidden"
            style={{ background: `linear-gradient(160deg, ${profile.gradientFrom} 0%, ${profile.gradientTo} 100%)` }}
          >
            {/* 아바타 중앙 배치 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-white/40 flex items-center justify-center text-6xl">
                {profile.emoji}
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
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] tracking-widest text-gray-500 uppercase">
                  부산 {profile.district} · {profile.job}
                </span>
                <span className="text-[10px] bg-white/60 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {profile.mbti}
                </span>
              </div>
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
                    d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              }
              label="부산 최애 스팟"
              value={profile.busanFavorite}
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
