'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClient } from '@/lib/supabase';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface Match {
  id: string;
  partner_id: string;
  partner_name: string;
  partner_birth_year: number | null;
  partner_mbti: string | null;
  partner_district: string | null;
  partner_photo_url: string | null;
  state: string;
  last_message: string | null;
  last_message_at: string | null;
  unread: number;
}

function partnerAge(birthYear: number | null): number | null {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간`;
  return `${Math.floor(hrs / 24)}일`;
}

const GRADIENTS = [
  { from: '#dbeafe', to: '#ede9fe' },
  { from: '#d1fae5', to: '#cffafe' },
  { from: '#fce7f3', to: '#fef3c7' },
  { from: '#fef3c7', to: '#fde8d5' },
];

export default function MatchesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useCurrentUser();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyIntroCount, setWeeklyIntroCount] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading || !user) {
      // 인증 완료됐지만 로그인 안 된 경우 로딩 해제
      if (!authLoading) setLoading(false);
      return;
    }

    const loadMatches = async () => {
      const supabase = getClient();

      // 내가 포함된 매치 목록
      const { data: matchRows } = await supabase
        .from('matches')
        .select('id, user_a_id, user_b_id, state, matched_at')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .in('state', ['waiting', 'active'])
        .order('matched_at', { ascending: false });

      if (!matchRows || matchRows.length === 0) {
        setLoading(false);
        return;
      }

      // 파트너 ID 목록
      const partnerIds = matchRows.map(m =>
        m.user_a_id === user.id ? m.user_b_id : m.user_a_id
      );

      // 파트너 프로필 일괄 조회
      const { data: partnerProfiles } = await supabase
        .from('users')
        .select('id, name, birth_year, mbti, district, profile_photo_url')
        .in('id', partnerIds);

      const profileMap: Record<string, typeof partnerProfiles extends (infer T)[] | null ? T : never> = {};
      partnerProfiles?.forEach(p => { if (p) profileMap[p.id] = p; });

      // 각 매치의 마지막 메시지 조회
      const enriched: Match[] = await Promise.all(
        matchRows.map(async (m, idx) => {
          const partnerId = m.user_a_id === user.id ? m.user_b_id : m.user_a_id;
          const partner = profileMap[partnerId];

          // 마지막 메시지
          const { data: msgs } = await supabase
            .from('chat_messages')
            .select('content, created_at, sender_id')
            .eq('match_id', m.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const lastMsg = msgs?.[0] ?? null;

          // 읽지 않은 메시지 (간소화: sender가 파트너인 메시지)
          const { count: unreadCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('match_id', m.id)
            .eq('sender_id', partnerId)
            .eq('is_read', false);

          return {
            id: m.id,
            partner_id: partnerId,
            partner_name: partner?.name ?? '상대방',
            partner_birth_year: partner?.birth_year ?? null,
            partner_mbti: partner?.mbti ?? null,
            partner_district: partner?.district ?? null,
            partner_photo_url: (partner as Record<string, unknown>)?.profile_photo_url as string | null ?? null,
            state: m.state,
            last_message: lastMsg?.content ?? null,
            last_message_at: lastMsg?.created_at ?? m.matched_at,
            unread: unreadCount ?? 0,
            _idx: idx,
          } as Match & { _idx: number };
        })
      );

      setMatches(enriched);
      setLoading(false);
    };

    // 주간 소개팅 카운터
    const loadWeeklyCount = async () => {
      const supabase = getClient();
      const { data } = await supabase
        .from('users')
        .select('weekly_intro_count')
        .eq('id', user.id)
        .single();
      if (data) setWeeklyIntroCount(data.weekly_intro_count ?? 0);
    };

    loadMatches();
    loadWeeklyCount();
  }, [user, authLoading]);

  if (authLoading || loading) {
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

  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen">
      {/* 헤더 */}
      <div className="px-6 pt-14 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">매칭</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {matches.length > 0 ? `${matches.length}명과 연결됨` : '아직 매칭이 없어요'}
          </p>
        </div>
        {weeklyIntroCount !== null && (
          <div className="flex flex-col items-end gap-0.5 mt-1">
            <div className="flex items-center gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-2.5 h-2.5 rounded-full
                  ${i < weeklyIntroCount ? 'bg-[#0f0f0f]' : 'bg-gray-200'}`} />
              ))}
            </div>
            <span className="text-[10px] text-gray-400">이번 주 {weeklyIntroCount}/3명</span>
          </div>
        )}
      </div>

      {matches.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <div className="text-4xl">💌</div>
          <p className="text-base font-medium text-gray-900">아직 매칭된 상대가 없어요</p>
          <p className="text-sm text-gray-400 leading-relaxed">
            탐색 탭에서 마음에 드는 분께<br />좋아요를 보내보세요!
          </p>
          <button onClick={() => router.push('/home')}
            className="mt-2 bg-[#0f0f0f] text-white px-6 py-3 rounded-full text-sm font-medium">
            탐색하러 가기
          </button>
        </div>
      ) : (
        <>
          {/* 새로운 매칭 가로 스크롤 */}
          <div className="px-6 mb-5">
            <p className="text-xs text-gray-400 mb-3">진행 중인 매칭</p>
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {matches.map((m, i) => {
                const g = GRADIENTS[i % GRADIENTS.length];
                const age = partnerAge(m.partner_birth_year);
                return (
                  <button
                    key={m.id}
                    onClick={() => router.push(`/chat/${m.id}`)}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className="relative">
                      {m.partner_photo_url ? (
                        <img
                          src={m.partner_photo_url}
                          alt={m.partner_name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-white"
                        />
                      ) : (
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-medium text-gray-700 border-2 border-white"
                          style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                        >
                          {m.partner_name.slice(0, 1)}
                        </div>
                      )}
                      {m.unread > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500
                                        flex items-center justify-center border border-white">
                          <span className="text-white text-[9px] font-medium">{m.unread}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-600">{m.partner_name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 구분선 */}
          <div className="h-px bg-gray-100 mx-6 mb-2" />

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto">
            <p className="text-xs text-gray-400 px-6 py-3">메시지</p>
            {matches.map((m, i) => {
              const g = GRADIENTS[i % GRADIENTS.length];
              const age = partnerAge(m.partner_birth_year);
              return (
                <button
                  key={m.id}
                  onClick={() => router.push(`/chat/${m.id}`)}
                  className="w-full flex items-center gap-3 px-6 py-3.5 active:bg-gray-50 transition-colors"
                >
                  {/* 아바타 */}
                  <div className="relative flex-shrink-0">
                    {m.partner_photo_url ? (
                      <img
                        src={m.partner_photo_url}
                        alt={m.partner_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium text-gray-700"
                        style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                      >
                        {m.partner_name.slice(0, 1)}
                      </div>
                    )}
                  </div>

                  {/* 텍스트 */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-baseline justify-between mb-0.5">
                      <span className={`text-sm ${m.unread > 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {m.partner_name}{age ? `, ${age}` : ''}
                        {m.partner_district && (
                          <span className="text-xs font-normal text-gray-400 ml-1">· {m.partner_district}</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-300 flex-shrink-0 ml-2">
                        {timeAgo(m.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${m.unread > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
                        {m.last_message ?? '매칭되었어요! 대화를 시작해보세요 👋'}
                      </p>
                      {m.unread > 0 && (
                        <div className="w-4 h-4 rounded-full bg-[#0f0f0f] flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[9px] font-medium">{m.unread}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 하단 채널 배너 */}
          <div className="mx-6 mt-4 mb-6 space-y-2.5">
            {/* 매니저 문의 */}
            <button
              onClick={() => router.push('/concierge')}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gray-50
                         border border-gray-100 active:bg-gray-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-[#0f0f0f] flex items-center justify-center
                              text-white text-xs flex-shrink-0">
                3V
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900">3rd Vibe 매니저</p>
                <p className="text-xs text-gray-400">매칭 관련 문의, 불편 신고</p>
              </div>
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* 연애 고민상담 */}
            <button
              onClick={() => router.push('/advice')}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-rose-50
                         border border-rose-100 active:bg-rose-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-rose-500 flex items-center justify-center
                              text-white text-sm flex-shrink-0">
                💕
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900">소개팅 · 연애 고민상담</p>
                <p className="text-xs text-gray-400">첫 만남, 데이트 고민을 털어놓으세요</p>
              </div>
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
