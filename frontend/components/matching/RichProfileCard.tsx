'use client';

/**
 * RichProfileCard — 가치관 일치율 + 공통 태그 + 음성 소개 포함 프로필 카드
 * ===========================================================================
 * 구성:
 *   [히어로 영역]   아바타 / 이름·나이·도시 / TrueNote 배지
 *   [일치율 띠]     MatchScore 게이지 + 등급 + 하이라이트 문구
 *   [공통 태그]     두 유저가 공통으로 선택한 태그 칩
 *   [음성 소개]     재생/정지 버튼 + 파형 애니메이션 + 타이머
 *   [연애관]        dating_values 텍스트 (펼치기/접기)
 */

import { useState, useRef, useEffect } from 'react';

// ── 타입 ──────────────────────────────────────────────────────
export interface MatchScoreData {
  score:            number;     // 0~100
  grade:            'S' | 'A' | 'B' | 'C';
  common_tag_ids:   string[];
  category_scores:  Record<string, number>;
  highlight:        string;
}

export interface RichProfileData {
  userId:          string;
  name:            string;
  age:             number;
  flag:            string;
  city:            string;
  job:             string;
  isTruenote:      boolean;
  gradientFrom:    string;
  gradientTo:      string;
  tagline:         string;
  datingValues:    string;
  voiceIntroUrl:   string | null;
  voiceDurationS:  number | null;
  allTags:         { id: string; label: string; category: string }[];
}

interface RichProfileCardProps {
  profile:    RichProfileData;
  matchScore: MatchScoreData;
  onLike?:    () => void;
  onPass?:    () => void;
  likeLocked?: boolean;  // 스크롤 미완료 잠금 여부
}

// ── 등급 색상 ─────────────────────────────────────────────────
const GRADE_CONFIG = {
  S: { bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-200',  label: 'S매치' },
  A: { bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-200',  label: 'A매치' },
  B: { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200',   label: 'B매치' },
  C: { bg: 'bg-gray-50',   text: 'text-gray-500',   border: 'border-gray-200',   label: 'C매치' },
};

// ── 파형 애니메이션 (SVG) ─────────────────────────────────────
function Waveform({ isPlaying }: { isPlaying: boolean }) {
  const bars = [3, 6, 9, 6, 12, 8, 5, 10, 7, 4, 9, 6, 11, 5, 8];
  return (
    <div className="flex items-center gap-[2px] h-8">
      {bars.map((h, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full bg-gray-400 transition-all
            ${isPlaying ? 'animate-pulse' : ''}`}
          style={{
            height: `${isPlaying ? Math.max(4, h * (0.6 + Math.random() * 0.6)) : h * 0.7}px`,
            animationDelay: `${i * 60}ms`,
            animationDuration: `${700 + (i % 3) * 200}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ── 음성 플레이어 ─────────────────────────────────────────────
function VoicePlayer({ url, durationS }: { url: string; durationS: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed]     = useState(0);
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const timerRef  = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setElapsed(0);
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      timerRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e >= durationS) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return e + 1;
        });
      }, 1000);
    }
  };

  useEffect(() => () => {
    audioRef.current?.pause();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const progress = durationS > 0 ? (elapsed / durationS) * 100 : 0;

  return (
    <div className="flex flex-col gap-3 bg-gray-50 rounded-2xl px-4 py-4">
      <div className="flex items-center gap-3">
        {/* 재생/정지 버튼 */}
        <button
          onClick={toggle}
          className="w-11 h-11 rounded-full bg-[#0f0f0f] flex items-center justify-center
                     flex-shrink-0 active:scale-95 transition-transform shadow-sm"
        >
          {isPlaying ? (
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* 파형 + 타이머 */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-medium">음성 소개</p>
            <span className="text-[10px] text-gray-400 font-mono tabular-nums">
              {isPlaying ? formatTime(elapsed) : formatTime(durationS)} / {formatTime(durationS)}
            </span>
          </div>
          <Waveform isPlaying={isPlaying} />
        </div>
      </div>

      {/* 진행 바 */}
      <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#0f0f0f] rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── 메인: 리치 프로필 카드 ────────────────────────────────────
export default function RichProfileCard({
  profile,
  matchScore,
  onLike,
  onPass,
  likeLocked = false,
}: RichProfileCardProps) {
  const [valuesExpanded, setValuesExpanded] = useState(false);

  const gradeConfig = GRADE_CONFIG[matchScore.grade];
  const commonTags  = profile.allTags.filter((t) =>
    matchScore.common_tag_ids.includes(t.id)
  );

  // 카테고리 점수 중 높은 것 2개 → 세부 하이라이트
  const topCategories = Object.entries(matchScore.category_scores)
    .filter(([, v]) => v >= 100)
    .slice(0, 2);

  return (
    <div className="flex flex-col bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">

      {/* ── 히어로 영역 ──────────────────────────────────── */}
      <div
        className="relative h-48 flex flex-col justify-end px-5 pb-5"
        style={{ background: `linear-gradient(145deg, ${profile.gradientFrom}, ${profile.gradientTo})` }}
      >
        {/* TrueNote 배지 */}
        {profile.isTruenote && (
          <div className="absolute top-4 right-4">
            <span className="inline-flex items-center gap-1 bg-[#0f0f0f]/80 backdrop-blur-sm
                             text-white text-[10px] px-2.5 py-1 rounded-full">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              TrueNote
            </span>
          </div>
        )}

        {/* 아바타 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-white/40 flex items-center justify-center text-5xl">
            {profile.flag}
          </div>
        </div>

        {/* 이름/도시 */}
        <div className="relative z-10">
          <p className="text-[10px] tracking-widest text-gray-500/80 uppercase mb-1">
            {profile.city} · {profile.job}
          </p>
          <h3 className="text-xl font-medium text-gray-900 tracking-tight">
            {profile.name}, {profile.age}
          </h3>
          <p className="text-sm text-gray-600 font-light italic mt-0.5">
            "{profile.tagline}"
          </p>
        </div>
      </div>

      {/* ── 가치관 일치율 띠 ─────────────────────────────── */}
      <div className={`px-5 py-4 border-b border-gray-100 ${gradeConfig.bg}`}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border
              ${gradeConfig.text} ${gradeConfig.border} bg-white`}>
              {gradeConfig.label}
            </span>
            <p className="text-xs text-gray-500">{matchScore.highlight}</p>
          </div>
          <span className={`text-2xl font-medium tabular-nums ${gradeConfig.text}`}>
            {matchScore.score}%
          </span>
        </div>

        {/* 일치율 게이지 */}
        <div className="w-full h-2 bg-white/70 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000
              ${matchScore.grade === 'S' ? 'bg-amber-400'
              : matchScore.grade === 'A' ? 'bg-green-400'
              : matchScore.grade === 'B' ? 'bg-blue-400'
              : 'bg-gray-300'}`}
            style={{ width: `${matchScore.score}%` }}
          />
        </div>

        {/* 카테고리별 100% 일치 하이라이트 */}
        {topCategories.length > 0 && (
          <div className="flex gap-2 mt-2.5">
            {topCategories.map(([cat]) => {
              const CAT_LABELS: Record<string, string> = {
                contact: '연락 스타일', weekend: '주말 성향',
                future: '미래 계획', values: '가치관',
                lifestyle: '라이프스타일', hobby: '취미',
              };
              return (
                <span key={cat}
                  className={`text-[10px] px-2 py-0.5 rounded-full ${gradeConfig.text} ${gradeConfig.bg}
                              border ${gradeConfig.border}`}>
                  {CAT_LABELS[cat] ?? cat} 완벽 일치 ✓
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-5 py-5 flex flex-col gap-5">

        {/* ── 공통 태그 ──────────────────────────────────── */}
        {commonTags.length > 0 && (
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2.5">
              함께 선택한 태그 {commonTags.length}개
            </p>
            <div className="flex flex-wrap gap-2">
              {commonTags.map((tag) => (
                <span
                  key={tag.id}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-50 text-gray-700
                             border border-gray-100 font-medium"
                >
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── 음성 소개 ──────────────────────────────────── */}
        {profile.voiceIntroUrl && profile.voiceDurationS ? (
          <VoicePlayer url={profile.voiceIntroUrl} durationS={profile.voiceDurationS} />
        ) : (
          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3.5">
            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </div>
            <p className="text-xs text-gray-400">음성 소개가 아직 없어요</p>
          </div>
        )}

        {/* ── 연애관 텍스트 ──────────────────────────────── */}
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">연애관</p>
          <div className="relative">
            <p className={`text-sm text-gray-700 leading-relaxed font-light transition-all
              ${valuesExpanded ? '' : 'line-clamp-3'}`}>
              {profile.datingValues}
            </p>
            {!valuesExpanded && profile.datingValues.length > 120 && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
            )}
          </div>
          {profile.datingValues.length > 120 && (
            <button
              onClick={() => setValuesExpanded((v) => !v)}
              className="text-xs text-gray-400 mt-1.5 underline-offset-2 underline"
            >
              {valuesExpanded ? '접기' : '더 보기'}
            </button>
          )}
        </div>
      </div>

      {/* ── 액션 버튼 ──────────────────────────────────────── */}
      {(onLike || onPass) && (
        <div className="flex gap-3 px-5 pb-5">
          {onPass && (
            <button
              onClick={onPass}
              className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center
                         text-gray-400 active:scale-95 transition-all flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {onLike && (
            <button
              onClick={onLike}
              disabled={likeLocked}
              className={`flex-1 py-3.5 rounded-2xl text-sm font-medium flex items-center justify-center gap-2
                          transition-all
                ${likeLocked
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-[#0f0f0f] text-white active:scale-[0.98]'}`}
            >
              <svg className="w-4 h-4" fill={likeLocked ? 'none' : 'currentColor'}
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={likeLocked ? 2 : 0}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              {likeLocked ? '자기소개까지 읽으면 활성화' : `${profile.name}에게 좋아요`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
