'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sendPhoneOtp, verifyPhoneOtp, getClient } from '@/lib/supabase';

// ── 타입 ──────────────────────────────────────────────────
type Step      = 'phone' | 'otp' | 'basic' | 'survey' | 'done';
type UserType  = 'worker' | 'student' | '';
type Gender    = 'male' | 'female' | '';

const STEPS: Step[] = ['phone', 'otp', 'basic', 'survey', 'done'];

const MBTI_LIST = [
  'INTJ','INTP','ENTJ','ENTP',
  'INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ',
  'ISTP','ISFP','ESTP','ESFP',
] as const;

const BUSAN_DATE_STYLES = [
  '광안리 카페투어 ☕', '해운대 해변 산책 🌊', '서면 맛집 탐방 🍜',
  '감천문화마을 데이트 🎨', '남포동 영화 데이트 🎬', '이기대 트레킹 🥾',
  '흰여울 문화마을 구경 🏘️', '부산 야경 드라이브 🚗', '기장 카페거리 🌿',
  '자갈치 시장 투어 🐟',
];

const HOBBIES = [
  '여행', '커피', '독서', '영화', '요리', '운동', '음악', '사진',
  '게임', '등산', '캠핑', '전시회', '야구 관람', '드라이브',
];

const PERSONALITY_TAGS = [
  '활발한', '조용한', '계획적인', '즉흥적인', '유머있는', '진지한',
  '다정한', '독립적인', '가족지향적', '커리어지향적',
];

const BUSAN_DISTRICTS = [
  '해운대구', '수영구', '남구', '부산진구', '동래구',
  '연제구', '금정구', '사하구', '서구', '중구',
];

interface FormData {
  // 계정
  phone: string; otp: string;
  // 기본
  name: string; birthYear: string; gender: Gender;
  userType: UserType;
  occupation: string; companyName: string;
  // 기본 설문
  mbti: string; personalityTags: string[]; hobbies: string[];
  dateStyles: string[]; busanDistrict: string; selfIntro: string;
  // Phase 1 — 기피 조건
  allowCrossType: 'yes' | 'no' | '';     // 직장인-대학생 교제 허용
  maxAgeDiff: '1' | '3' | '5' | 'any' | '';
  smokingOk: 'ok' | 'no' | '';
  religionPref: string;
  // Phase 2 — 부산 라이프스타일
  drinkingLevel: string;
  contactFreq: string;
  // Phase 3 — MBTI 심화
  conflictStyle: 'T' | 'F' | '';
  planningStyle: 'J' | 'P' | '';
  // Phase 4 — 주관식
  busanFavoritePlace: string;
  relationshipValue: string;
}

// ── 카드 스와이프 설문 데이터 ─────────────────────────────
type CardType = 'choice' | 'multi' | 'text' | 'scale';

interface SurveyCard {
  id: keyof FormData | string;
  phase: 1 | 2 | 3 | 4;
  phaseLabel: string;
  question: string;
  emoji: string;
  type: CardType;
  options?: { label: string; value: string; emoji?: string }[];
  hint?: string;
  maxSelect?: number;
}

const SURVEY_CARDS: SurveyCard[] = [
  // ── Phase 1: 기피 조건 ──────────────────────────────────
  {
    id: 'allowCrossType', phase: 1, phaseLabel: '기피 조건',
    question: '직장인 ↔ 대학생 사이의\n만남은 괜찮으신가요?',
    emoji: '🎓💼',
    type: 'choice',
    options: [
      { label: '네, 열린 마음이에요', value: 'yes', emoji: '✅' },
      { label: '같은 상황인 분이 좋아요', value: 'no', emoji: '🙅' },
    ],
  },
  {
    id: 'maxAgeDiff', phase: 1, phaseLabel: '기피 조건',
    question: '나이 차이는 몇 살까지\n가능하신가요?',
    emoji: '🎂',
    type: 'choice',
    options: [
      { label: '1살 이내', value: '1' },
      { label: '3살 이내', value: '3' },
      { label: '5살 이내', value: '5' },
      { label: '상관없어요', value: 'any', emoji: '💕' },
    ],
  },
  {
    id: 'smokingOk', phase: 1, phaseLabel: '기피 조건',
    question: '상대방이 흡연자라면\n어떠신가요?',
    emoji: '🚬',
    type: 'choice',
    options: [
      { label: '괜찮아요', value: 'ok', emoji: '😊' },
      { label: '비흡연자만 선호해요', value: 'no', emoji: '🚫' },
    ],
  },
  {
    id: 'religionPref', phase: 1, phaseLabel: '기피 조건',
    question: '종교에 대한\n생각은 어떠세요?',
    emoji: '🙏',
    type: 'choice',
    options: [
      { label: '전혀 상관없어요', value: 'none' },
      { label: '같은 종교면 좋겠어요', value: 'same' },
      { label: '특정 종교만 아니라면', value: 'flexible' },
      { label: '비종교인이면 좋겠어요', value: 'no_religion' },
    ],
  },
  // ── Phase 2: 부산 라이프스타일 ───────────────────────────
  {
    id: 'dateStyles', phase: 2, phaseLabel: '부산 라이프스타일',
    question: '선호하는 부산 데이트\n스타일을 골라주세요',
    emoji: '🌊',
    type: 'multi',
    maxSelect: 3,
    options: BUSAN_DATE_STYLES.map(s => ({ label: s, value: s })),
    hint: '최대 3개 선택 가능',
  },
  {
    id: 'drinkingLevel', phase: 2, phaseLabel: '부산 라이프스타일',
    question: '평소 음주 성향은\n어느 쪽인가요?',
    emoji: '🍻',
    type: 'choice',
    options: [
      { label: '전혀 안 마셔요', value: '안 마심', emoji: '🧃' },
      { label: '가끔 한두 잔', value: '가끔', emoji: '🍷' },
      { label: '분위기에 따라', value: '상황따라', emoji: '🎉' },
      { label: '자주 즐겨요', value: '자주', emoji: '🍺' },
    ],
  },
  {
    id: 'contactFreq', phase: 2, phaseLabel: '부산 라이프스타일',
    question: '연애 중 연락 빈도는\n어느 정도가 좋으세요?',
    emoji: '💬',
    type: 'choice',
    options: [
      { label: '매일 연락해요', value: '매일 연락해요', emoji: '📲' },
      { label: '하루 한두 번', value: '하루 한두 번이 좋아요', emoji: '☀️' },
      { label: '이틀에 한 번도 OK', value: '바쁠 땐 이틀에 한 번도 괜찮아요', emoji: '🗓️' },
      { label: '자유롭게', value: '자유롭게, 연락이 와야 답해요', emoji: '🦋' },
    ],
  },
  // ── Phase 3: MBTI 심화 ────────────────────────────────────
  {
    id: 'conflictStyle', phase: 3, phaseLabel: 'MBTI 심화',
    question: '연인과 갈등이 생기면\n어떻게 해결하세요?',
    emoji: '💭',
    type: 'choice',
    options: [
      { label: '논리적으로 해결해요 (T)', value: 'T', emoji: '🧠' },
      { label: '감정을 먼저 나눠요 (F)', value: 'F', emoji: '💕' },
    ],
  },
  {
    id: 'planningStyle', phase: 3, phaseLabel: 'MBTI 심화',
    question: '데이트 계획은\n어떤 스타일인가요?',
    emoji: '📅',
    type: 'choice',
    options: [
      { label: '미리 꼼꼼히 계획해요 (J)', value: 'J', emoji: '📝' },
      { label: '즉흥적으로 움직여요 (P)', value: 'P', emoji: '🎲' },
    ],
  },
  // ── Phase 4: 주관식 ──────────────────────────────────────
  {
    id: 'busanFavoritePlace', phase: 4, phaseLabel: '나만의 이야기',
    question: '부산에서 가장 좋아하는\n장소와 이유를 알려주세요 🗺️',
    emoji: '📍',
    type: 'text',
    hint: '예: 광안리 ○○카페 — 바다 보며 책 읽기 좋아서요',
  },
  {
    id: 'relationshipValue', phase: 4, phaseLabel: '나만의 이야기',
    question: '연애에서 절대 지켜야 할\n가치관이 있다면?',
    emoji: '💝',
    type: 'text',
    hint: '예: 서로의 일상을 공유하되 개인 시간은 존중해요',
  },
];

const PHASE_COLORS: Record<number, { bg: string; text: string; bar: string }> = {
  1: { bg: 'bg-rose-50',   text: 'text-rose-600',   bar: 'bg-rose-400'   },
  2: { bg: 'bg-blue-50',   text: 'text-blue-600',   bar: 'bg-blue-400'   },
  3: { bg: 'bg-amber-50',  text: 'text-amber-600',  bar: 'bg-amber-400'  },
  4: { bg: 'bg-emerald-50',text: 'text-emerald-600',bar: 'bg-emerald-400' },
};

// ── 진행 바 ───────────────────────────────────────────────
function ProgressBar({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full bg-[#0f0f0f] rounded-full transition-all duration-500"
        style={{ width: `${Math.round(((idx + 1) / STEPS.length) * 100)}%` }} />
    </div>
  );
}

function toE164(phone: string): string {
  return `+82${phone.replace(/\D/g, '').replace(/^0/, '')}`;
}

// ── STEP 1: 전화번호 ──────────────────────────────────────
function StepPhone({ form, setForm, onNext }: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onNext: (e164: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const isValid = form.phone.replace(/\D/g, '').length >= 9;

  const handleSend = async () => {
    setError(''); setLoading(true);
    const e164 = toE164(form.phone);
    const { error: err } = await sendPhoneOtp(e164);
    setLoading(false);
    if (err) { setError(err.message || 'SMS 발송 실패. 잠시 후 다시 시도해 주세요.'); return; }
    onNext(e164);
  };

  return (
    <div className="flex flex-col flex-1 px-6 pt-8">
      <div className="mb-8">
        <p className="text-xs text-gray-400 mb-1">01 · 본인 인증</p>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">휴대폰 번호를<br />입력해 주세요</h2>
        <p className="text-xs text-gray-400">실명 인증용 · 가상번호 불가</p>
      </div>
      <div className="flex gap-2 mb-2">
        <div className="flex items-center px-3 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm text-gray-400">
          🇰🇷 +82
        </div>
        <input value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder="010-0000-0000" type="tel"
          className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     outline-none focus:border-gray-300"
          onKeyDown={e => e.key === 'Enter' && isValid && handleSend()} />
      </div>
      {error && <p className="text-xs text-red-500 mb-4">{error}</p>}
      <button onClick={handleSend} disabled={!isValid || loading}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   disabled:opacity-30 active:scale-[0.98] transition-all mt-auto mb-8">
        {loading ? '발송 중...' : '인증번호 받기'}
      </button>
    </div>
  );
}

// ── STEP 2: OTP ───────────────────────────────────────────
function StepOTP({ form, setForm, e164Phone, onNext }: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  e164Phone: string;
  onNext: () => Promise<void>;
}) {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [cooldown, setCooldown] = useState(30);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleChange = (i: number, v: string) => {
    const digits = v.replace(/\D/g, '').slice(-1);
    const arr = form.otp.split('');
    arr[i] = digits;
    const next = arr.join('').slice(0, 6);
    setForm(f => ({ ...f, otp: next }));
    if (digits && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !form.otp[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };

  const handleVerify = async () => {
    setError(''); setLoading(true);
    const { error: err } = await verifyPhoneOtp(e164Phone, form.otp);
    setLoading(false);
    if (err) { setError('인증번호가 올바르지 않습니다.'); return; }
    await onNext();
  };

  return (
    <div className="flex flex-col flex-1 px-6 pt-8">
      <div className="mb-8">
        <p className="text-xs text-gray-400 mb-1">01 · 본인 인증</p>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">인증번호를<br />입력해 주세요</h2>
        <p className="text-xs text-gray-400">{e164Phone} 으로 발송됐습니다</p>
      </div>
      <div className="flex gap-2 justify-center mb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <input key={i}
            ref={el => { inputsRef.current[i] = el; }}
            type="tel" maxLength={1} value={form.otp[i] ?? ''}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className={`w-11 h-14 text-center text-xl font-semibold rounded-2xl border-2 outline-none
              transition-colors ${form.otp[i] ? 'border-[#0f0f0f] bg-gray-50' : 'border-gray-100 bg-gray-50'}`}
          />
        ))}
      </div>
      {error && <p className="text-xs text-red-500 text-center mb-2">{error}</p>}
      <p className="text-xs text-gray-400 mb-8 text-center">
        {cooldown > 0
          ? <span className="text-gray-300">재발송 가능: {cooldown}초 후</span>
          : <button onClick={async () => {
              await sendPhoneOtp(e164Phone); setCooldown(30);
              setForm(f => ({ ...f, otp: '' }));
            }} className="underline">인증번호 재발송</button>}
      </p>
      <button onClick={handleVerify} disabled={form.otp.length < 6 || loading}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   disabled:opacity-30 active:scale-[0.98] transition-all mt-auto mb-8">
        {loading ? '확인 중...' : '인증 완료'}
      </button>
    </div>
  );
}

// ── STEP 3: 기본 정보 (user_type 포함) ───────────────────
function StepBasic({ form, setForm, onNext }: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onNext: () => void;
}) {
  const canNext = form.name.trim() && form.birthYear && form.gender && form.userType && form.occupation.trim();

  return (
    <div className="flex flex-col flex-1 px-6 pt-8 overflow-y-auto">
      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-1">02 · 기본 정보</p>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">기본 정보를<br />입력해 주세요</h2>
      </div>

      {/* 이름 */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-1.5">이름</p>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="실명 입력" type="text"
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     outline-none focus:border-gray-300" />
      </div>

      {/* 출생 연도 */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-1.5">출생 연도</p>
        <input value={form.birthYear} onChange={e => setForm(f => ({ ...f, birthYear: e.target.value }))}
          placeholder="예: 1998" type="number" min="1970" max="2007"
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     outline-none focus:border-gray-300" />
      </div>

      {/* 성별 */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-1.5">성별</p>
        <div className="flex gap-3">
          {(['male', 'female'] as Gender[]).map(g => (
            <button key={g} onClick={() => setForm(f => ({ ...f, gender: g }))}
              className={`flex-1 py-3.5 rounded-2xl text-sm font-medium border-[1.5px] transition-all
                ${form.gender === g
                  ? 'border-[#0f0f0f] bg-[#0f0f0f] text-white'
                  : 'border-gray-100 bg-gray-50 text-gray-700'}`}>
              {g === 'male' ? '남성 👨' : '여성 👩'}
            </button>
          ))}
        </div>
      </div>

      {/* 직업 유형 — 새 필드 */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-1.5">직업 유형</p>
        <div className="flex gap-3">
          {([
            { value: 'worker',  label: '직장인 💼' },
            { value: 'student', label: '대학(원)생 🎓' },
          ] as { value: UserType; label: string }[]).map(t => (
            <button key={t.value} onClick={() => setForm(f => ({ ...f, userType: t.value }))}
              className={`flex-1 py-3.5 rounded-2xl text-sm font-medium border-[1.5px] transition-all
                ${form.userType === t.value
                  ? 'border-[#0f0f0f] bg-[#0f0f0f] text-white'
                  : 'border-gray-100 bg-gray-50 text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 직업/전공 */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-1.5">
          {form.userType === 'student' ? '전공 / 학과' : '직업'}
        </p>
        <input value={form.occupation}
          onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))}
          placeholder={form.userType === 'student' ? '예: 경영학과, 컴퓨터공학과' : '예: 마케터, 개발자, 간호사'}
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     outline-none focus:border-gray-300" />
      </div>

      {/* 회사/학교명 */}
      <div className="mb-8">
        <p className="text-xs text-gray-400 mb-1.5">
          {form.userType === 'student' ? '학교명' : '회사/기관명'}
          <span className="text-gray-300"> (선택)</span>
        </p>
        <input value={form.companyName}
          onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
          placeholder={form.userType === 'student' ? '예: 부산대학교' : '추후 서류 인증에서 확인됩니다'}
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     outline-none focus:border-gray-300" />
      </div>

      <button onClick={onNext} disabled={!canNext}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   disabled:opacity-30 active:scale-[0.98] transition-all mb-8">
        다음
      </button>
    </div>
  );
}

// ── STEP 4: 카드 스와이프 설문 ───────────────────────────
function StepSurvey({ form, setForm, onNext }: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onNext: () => Promise<void>;
}) {
  const [cardIdx, setCardIdx] = useState(0);
  const [animDir, setAnimDir] = useState<'left' | 'right' | null>(null);
  const [saving, setSaving]   = useState(false);
  const [textDraft, setTextDraft] = useState('');

  const card     = SURVEY_CARDS[cardIdx];
  const phase    = card.phase;
  const colors   = PHASE_COLORS[phase];
  const progress = cardIdx / (SURVEY_CARDS.length - 1);
  const isLast   = cardIdx === SURVEY_CARDS.length - 1;

  // 현재 카드 값 읽기/쓰기
  const currentValue = (() => {
    const v = form[card.id as keyof FormData];
    return v ?? '';
  })();

  const setValue = (val: string | string[]) => {
    setForm(f => ({ ...f, [card.id]: val }));
  };

  const isAnswered = (() => {
    if (card.type === 'text') return (form[card.id as keyof FormData] as string)?.length >= 10;
    if (card.type === 'multi') return (form[card.id as keyof FormData] as string[])?.length >= 1;
    return !!(form[card.id as keyof FormData]);
  })();

  const goNext = () => {
    if (!isAnswered && card.type !== 'text') return;
    if (isLast) { setSaving(true); onNext().finally(() => setSaving(false)); return; }
    setAnimDir('left');
    setTimeout(() => { setCardIdx(i => i + 1); setTextDraft(''); setAnimDir(null); }, 220);
  };

  const goPrev = () => {
    if (cardIdx === 0) return;
    setAnimDir('right');
    setTimeout(() => { setCardIdx(i => i - 1); setAnimDir(null); }, 220);
  };

  // 멀티 선택 토글
  const toggleMulti = (val: string) => {
    const arr = (form[card.id as keyof FormData] as string[]) ?? [];
    const max = card.maxSelect ?? 99;
    if (arr.includes(val)) setValue(arr.filter(v => v !== val));
    else if (arr.length < max) setValue([...arr, val]);
  };

  return (
    <div className="flex flex-col flex-1 px-6 pt-6 pb-8 overflow-hidden">
      {/* 페이즈 + 진행 표시 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors.bg} ${colors.text}`}>
            Phase {phase} · {card.phaseLabel}
          </span>
          <span className="text-xs text-gray-300">{cardIdx + 1} / {SURVEY_CARDS.length}</span>
        </div>
        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
            style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {/* 카드 */}
      <div className={`flex-1 flex flex-col transition-all duration-200
        ${animDir === 'left'  ? '-translate-x-8 opacity-0' : ''}
        ${animDir === 'right' ? 'translate-x-8  opacity-0' : ''}
        ${!animDir ? 'translate-x-0 opacity-100' : ''}`}>

        {/* 질문 카드 */}
        <div className={`rounded-3xl p-6 mb-5 ${colors.bg}`}>
          <div className="text-4xl mb-4">{card.emoji}</div>
          <h3 className="text-xl font-semibold text-gray-900 whitespace-pre-line leading-snug">
            {card.question}
          </h3>
          {card.hint && (
            <p className="text-xs text-gray-400 mt-2">{card.hint}</p>
          )}
        </div>

        {/* 선택지 */}
        <div className="flex-1 overflow-y-auto">
          {card.type === 'choice' && (
            <div className="flex flex-col gap-2">
              {card.options?.map(opt => {
                const selected = currentValue === opt.value;
                return (
                  <button key={opt.value}
                    onClick={() => { setValue(opt.value); setTimeout(goNext, 300); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2
                               text-left text-sm font-medium transition-all active:scale-[0.98]
                      ${selected
                        ? 'border-[#0f0f0f] bg-[#0f0f0f] text-white'
                        : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'}`}>
                    {opt.emoji && <span className="text-base">{opt.emoji}</span>}
                    {opt.label}
                    {selected && <span className="ml-auto">✓</span>}
                  </button>
                );
              })}
            </div>
          )}

          {card.type === 'multi' && (
            <div className="flex flex-wrap gap-2">
              {card.options?.map(opt => {
                const arr    = (form[card.id as keyof FormData] as string[]) ?? [];
                const sel    = arr.includes(opt.value);
                const maxed  = arr.length >= (card.maxSelect ?? 99) && !sel;
                return (
                  <button key={opt.value}
                    onClick={() => toggleMulti(opt.value)}
                    disabled={maxed}
                    className={`text-xs px-3 py-2 rounded-2xl border-[1.5px] transition-all
                      ${sel
                        ? 'border-[#0f0f0f] bg-[#0f0f0f] text-white'
                        : maxed
                          ? 'border-gray-100 bg-gray-50 text-gray-300'
                          : 'border-gray-200 bg-white text-gray-600'}`}>
                    {opt.label}
                  </button>
                );
              })}
              {card.maxSelect && (
                <p className="w-full text-xs text-gray-300 mt-1">
                  {((form[card.id as keyof FormData] as string[]) ?? []).length} / {card.maxSelect} 선택됨
                </p>
              )}
            </div>
          )}

          {card.type === 'text' && (
            <div>
              <textarea
                value={(form[card.id as keyof FormData] as string) ?? ''}
                onChange={e => setValue(e.target.value)}
                placeholder={card.hint ?? '자유롭게 적어주세요'}
                rows={4}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5
                           text-sm outline-none focus:border-gray-300 resize-none"
              />
              <div className="w-full h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${colors.bar}`}
                  style={{ width: `${Math.min((((form[card.id as keyof FormData] as string) ?? '').length / 10) * 100, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-300 mt-1 text-right">
                {((form[card.id as keyof FormData] as string) ?? '').length}자 (최소 10자)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 하단 네비게이션 */}
      <div className="flex items-center gap-3 mt-4">
        {cardIdx > 0 && (
          <button onClick={goPrev}
            className="w-12 h-12 rounded-2xl border border-gray-100 flex items-center justify-center
                       text-gray-400 active:bg-gray-50 transition-colors flex-shrink-0">
            ←
          </button>
        )}
        {(card.type !== 'choice') && (
          <button onClick={goNext}
            disabled={!isAnswered || saving}
            className="flex-1 bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                       disabled:opacity-30 active:scale-[0.98] transition-all">
            {saving ? '저장 중...' : isLast ? '가입 완료 🎉' : '다음'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── STEP 5: 완료 ──────────────────────────────────────────
function StepDone({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 text-center">
      <div className="text-5xl mb-5">🎉</div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-3">가입 완료!</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-8">
        다음 단계로 <strong>인증 서류</strong>를 제출하고<br />
        <strong>보증금 결제</strong>를 완료하면<br />
        매칭이 시작됩니다 ✨
      </p>
      <div className="w-full bg-gray-50 rounded-2xl p-4 mb-8 text-left">
        {[
          { step: '1', label: '서류 인증 제출', sub: '직장인/대학생 맞춤 서류 · 영업일 1~2일' },
          { step: '2', label: '관리자 승인', sub: '심사 완료 시 문자 발송' },
          { step: '3', label: '보증금 결제', sub: '6만원 · 3회 만남 실패 시 3만원 환불' },
          { step: '4', label: '매칭 시작!', sub: '3rd Vibe팀이 직접 큐레이션합니다' },
        ].map(s => (
          <div key={s.step} className="flex items-start gap-3 mb-3 last:mb-0">
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center
                            text-xs font-medium flex-shrink-0 mt-0.5">
              {s.step}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{s.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onContinue}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   active:scale-[0.98] transition-all">
        서류 인증 하러 가기 →
      </button>
    </div>
  );
}

// ── 메인 온보딩 ───────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep]         = useState<Step>('phone');
  const [e164Phone, setE164Phone] = useState('');
  const [form, setForm] = useState<FormData>({
    phone: '', otp: '',
    name: '', birthYear: '', gender: '', userType: '', occupation: '', companyName: '',
    mbti: '', personalityTags: [], hobbies: [], dateStyles: [], busanDistrict: '', selfIntro: '',
    allowCrossType: '', maxAgeDiff: '', smokingOk: '', religionPref: '',
    drinkingLevel: '', contactFreq: '',
    conflictStyle: '', planningStyle: '',
    busanFavoritePlace: '', relationshipValue: '',
  });

  const next = async () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const saveAndNext = async () => {
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { await next(); return; }

    const birthYear = parseInt(form.birthYear, 10);

    // users 테이블 업서트
    await supabase.from('users').upsert({
      id:           user.id,
      phone:        user.phone ?? '',
      name:         form.name.trim(),
      birth_year:   isNaN(birthYear) ? undefined : birthYear,
      gender:       form.gender || null,
      user_type:    form.userType || null,
      occupation:   form.occupation.trim() || null,
      company_name: form.companyName.trim() || null,
      district:     form.busanDistrict || null,
      mbti:         form.conflictStyle && form.planningStyle
                      ? `??${form.conflictStyle}${form.planningStyle}`  // 부분 MBTI
                      : null,
      hobbies:      form.hobbies.length ? form.hobbies : null,
      date_styles:  form.dateStyles.length ? form.dateStyles : null,
      contact_freq: form.contactFreq || null,
      bio:          form.selfIntro.trim() || null,
      is_active:    true,
    }, { onConflict: 'id' });

    // surveys 테이블 저장
    await supabase.from('surveys').upsert({
      user_id:           user.id,
      allow_cross_type:  form.allowCrossType === 'yes' ? true : form.allowCrossType === 'no' ? false : null,
      max_age_diff:      form.maxAgeDiff === 'any' ? 99 : form.maxAgeDiff ? parseInt(form.maxAgeDiff) : null,
      smoking_ok:        form.smokingOk === 'ok' ? true : form.smokingOk === 'no' ? false : null,
      religion_pref:     form.religionPref || null,
      drinking_level:    form.drinkingLevel || null,
      conflict_style:    form.conflictStyle || null,
      planning_style:    form.planningStyle || null,
      busan_favorite_place: form.busanFavoritePlace || null,
      relationship_value:   form.relationshipValue || null,
      preferred_date_styles: form.dateStyles.length ? form.dateStyles : null,
      contact_frequency: form.contactFreq || null,
    }, { onConflict: 'user_id' });

    await next();
  };

  const back = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
    else router.push('/');
  };

  const STEP_LABELS: Record<Step, string> = {
    phone: '전화번호', otp: 'OTP 인증', basic: '기본 정보', survey: '가치관', done: '완료',
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {step !== 'done' && (
        <div className="flex items-center gap-4 px-6 pt-14 pb-4">
          <button onClick={back} className="w-8 h-8 flex items-center justify-center -ml-1">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1"><ProgressBar current={step} /></div>
          <span className="text-xs text-gray-300 w-14 text-right">{STEP_LABELS[step]}</span>
        </div>
      )}

      {step === 'phone'  && <StepPhone  form={form} setForm={setForm} onNext={e164 => { setE164Phone(e164); next(); }} />}
      {step === 'otp'    && <StepOTP    form={form} setForm={setForm} e164Phone={e164Phone} onNext={async () => {
        const supabase = getClient();
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          const { data: profile } = await supabase
            .from('users')
            .select('verification_status, is_deposit_paid, name')
            .eq('id', u.id)
            .single();
          if (profile?.verification_status === 'approved' && profile?.is_deposit_paid && profile?.name) {
            router.replace('/home');
            return;
          }
        }
        next();
      }} />}
      {step === 'basic'  && <StepBasic  form={form} setForm={setForm} onNext={next} />}
      {step === 'survey' && <StepSurvey form={form} setForm={setForm} onNext={saveAndNext} />}
      {step === 'done'   && <StepDone   onContinue={() => router.push('/verify-docs')} />}
    </div>
  );
}
