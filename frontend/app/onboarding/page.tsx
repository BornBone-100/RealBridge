'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sendPhoneOtp, verifyPhoneOtp } from '@/lib/supabase';

// ── 타입 ──────────────────────────────────────────────────
type Step = 'phone' | 'otp' | 'basic' | 'survey' | 'done';

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

const CONTACT_FREQ = [
  '매일 연락해요', '하루 한두 번이 좋아요', '바쁠 땐 이틀에 한 번도 괜찮아요',
  '자유롭게, 연락이 와야 답해요',
];

const BUSAN_DISTRICTS = [
  '해운대구', '수영구', '남구', '부산진구', '동래구',
  '연제구', '금정구', '사하구', '서구', '중구',
];

interface FormData {
  phone: string;
  otp: string;
  name: string;
  birthYear: string;
  gender: 'male' | 'female' | '';
  occupation: string;
  companyName: string;
  mbti: string;
  personalityTags: string[];
  hobbies: string[];
  dateStyles: string[];
  contactFreq: string;
  relationshipGoal: string;
  busanDistrict: string;
  selfIntro: string;
}

// ── 진행 바 ───────────────────────────────────────────────
function ProgressBar({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  const pct = Math.round(((idx + 1) / STEPS.length) * 100);
  return (
    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full bg-[#0f0f0f] rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── E.164 변환 ────────────────────────────────────────────
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0/, '');
  return `+82${digits}`;
}

// ── STEP 1: 전화번호 ──────────────────────────────────────
function StepPhone({ form, setForm, onNext }: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onNext: (e164: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isValid = form.phone.replace(/\D/g, '').length >= 9;

  const handleSend = async () => {
    setError('');
    setLoading(true);
    const e164 = toE164(form.phone);
    const { error: err } = await sendPhoneOtp(e164);
    setLoading(false);
    if (err) { setError(err.message || 'SMS 발송 실패. 잠시 후 다시 시도해 주세요.'); return; }
    onNext(e164);
  };

  return (
    <div className="flex flex-col flex-1 px-6 pt-8">
      <div className="mb-8">
        <p className="text-xs text-gray-400 mb-1">01 · 전화번호 인증</p>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2 tracking-tight">
          안녕하세요! 👋<br />전화번호를 입력해 주세요
        </h2>
        <p className="text-sm text-gray-400">본인 명의 번호로만 가입 가능합니다</p>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5">
          <span>🇰🇷</span>
          <span className="text-sm text-gray-600">+82</span>
        </div>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => { setForm(f => ({ ...f, phone: e.target.value })); setError(''); }}
          placeholder="010-0000-0000"
          className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     outline-none focus:border-gray-300 transition-colors"
        />
      </div>
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
      <p className="text-xs text-gray-300 mb-8">인증 문자(SMS)가 발송됩니다</p>

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
  onNext: () => void;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = form.otp.split('').concat(Array(6).fill('')).slice(0, 6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(30);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleDigit = (idx: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const next = digits.slice(); next[idx] = clean;
    setForm(f => ({ ...f, otp: next.join('') }));
    setError('');
    if (clean && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleVerify = async () => {
    setError(''); setLoading(true);
    const { error: err } = await verifyPhoneOtp(e164Phone, form.otp);
    setLoading(false);
    if (err) {
      setError('인증번호가 올바르지 않습니다.');
      setForm(f => ({ ...f, otp: '' }));
      inputRefs.current[0]?.focus();
      return;
    }
    onNext();
  };

  return (
    <div className="flex flex-col flex-1 px-6 pt-8">
      <div className="mb-8">
        <p className="text-xs text-gray-400 mb-1">01 · 전화번호 인증</p>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">인증번호를 입력해 주세요</h2>
        <p className="text-sm text-gray-400">{e164Phone}로 발송된 6자리 번호</p>
      </div>

      <div className="flex gap-2 justify-between mb-6">
        {digits.map((d, i) => (
          <input key={i} ref={el => { inputRefs.current[i] = el; }}
            type="tel" maxLength={1} value={d}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => e.key === 'Backspace' && !d && i > 0 && inputRefs.current[i-1]?.focus()}
            className={`w-12 h-14 text-center text-xl font-medium rounded-2xl border-[1.5px] outline-none
              ${error ? 'border-red-300 bg-red-50' : d ? 'border-[#0f0f0f]' : 'border-gray-100 bg-gray-50'}
              focus:border-gray-400 transition-colors`} />
        ))}
      </div>
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      <p className="text-xs text-gray-400 mb-8">
        {cooldown > 0
          ? <span className="text-gray-300">재발송 가능: {cooldown}초 후</span>
          : <button onClick={async () => { await sendPhoneOtp(e164Phone); setCooldown(30); setForm(f => ({...f, otp:''})); }}
              className="underline">인증번호 재발송</button>}
      </p>

      <button onClick={handleVerify} disabled={form.otp.length < 6 || loading}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   disabled:opacity-30 active:scale-[0.98] transition-all mt-auto mb-8">
        {loading ? '확인 중...' : '인증 완료'}
      </button>
    </div>
  );
}

// ── STEP 3: 기본 정보 ─────────────────────────────────────
function StepBasic({ form, setForm, onNext }: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onNext: () => void;
}) {
  const canNext = form.name.trim() && form.birthYear && form.gender && form.occupation.trim();

  return (
    <div className="flex flex-col flex-1 px-6 pt-8 overflow-y-auto">
      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-1">02 · 기본 정보</p>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">기본 정보를 입력해 주세요</h2>
      </div>

      {/* 이름 */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-1.5">이름</p>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="실명 입력" type="text"
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     outline-none focus:border-gray-300 transition-colors" />
      </div>

      {/* 출생 연도 */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-1.5">출생 연도</p>
        <input value={form.birthYear} onChange={e => setForm(f => ({ ...f, birthYear: e.target.value }))}
          placeholder="예: 1995" type="number" min="1970" max="2005"
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     outline-none focus:border-gray-300 transition-colors" />
      </div>

      {/* 성별 */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-1.5">성별</p>
        <div className="flex gap-3">
          {(['male', 'female'] as const).map(g => (
            <button key={g} onClick={() => setForm(f => ({ ...f, gender: g }))}
              className={`flex-1 py-3.5 rounded-2xl text-sm font-medium border-[1.5px] transition-all
                ${form.gender === g ? 'border-[#0f0f0f] bg-[#0f0f0f] text-white' : 'border-gray-100 bg-gray-50 text-gray-700'}`}>
              {g === 'male' ? '남성 👨' : '여성 👩'}
            </button>
          ))}
        </div>
      </div>

      {/* 직업 */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-1.5">직업</p>
        <input value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))}
          placeholder="예: 마케터, 개발자, 간호사 등"
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     outline-none focus:border-gray-300 transition-colors" />
      </div>

      {/* 회사명 (선택) */}
      <div className="mb-8">
        <p className="text-xs text-gray-400 mb-1.5">회사/기관명 <span className="text-gray-300">(선택)</span></p>
        <input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
          placeholder="추후 서류 인증에서 확인됩니다"
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     outline-none focus:border-gray-300 transition-colors" />
      </div>

      <button onClick={onNext} disabled={!canNext}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   disabled:opacity-30 active:scale-[0.98] transition-all mb-8">
        다음
      </button>
    </div>
  );
}

// ── STEP 4: 가치관 설문 ───────────────────────────────────
function StepSurvey({ form, setForm, onNext }: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  onNext: () => void;
}) {
  const toggle = (key: 'personalityTags' | 'hobbies' | 'dateStyles', val: string, max: number) => {
    setForm(f => {
      const arr = f[key];
      if (arr.includes(val)) return { ...f, [key]: arr.filter(v => v !== val) };
      if (arr.length >= max) return f;
      return { ...f, [key]: [...arr, val] };
    });
  };

  const canNext = form.mbti && form.dateStyles.length >= 1 && form.contactFreq && form.selfIntro.length >= 50;

  return (
    <div className="flex flex-col flex-1 px-6 pt-8 overflow-y-auto">
      <div className="mb-6">
        <p className="text-xs text-gray-400 mb-1">03 · 가치관 & 취향</p>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">나를 소개해 주세요</h2>
        <p className="text-xs text-gray-400">매칭 정확도를 높이는 설문입니다</p>
      </div>

      {/* MBTI */}
      <div className="mb-5">
        <p className="text-xs text-gray-400 mb-2">MBTI</p>
        <div className="flex flex-wrap gap-2">
          {MBTI_LIST.map(m => (
            <button key={m} onClick={() => setForm(f => ({ ...f, mbti: m }))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                ${form.mbti === m ? 'bg-[#0f0f0f] text-white border-[#0f0f0f]' : 'bg-white text-gray-500 border-gray-200'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* 성격 */}
      <div className="mb-5">
        <p className="text-xs text-gray-400 mb-2">성격 <span className="text-gray-300">(최대 3개)</span></p>
        <div className="flex flex-wrap gap-2">
          {PERSONALITY_TAGS.map(t => (
            <button key={t} onClick={() => toggle('personalityTags', t, 3)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                ${form.personalityTags.includes(t) ? 'bg-[#0f0f0f] text-white border-[#0f0f0f]' : 'bg-white text-gray-500 border-gray-200'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 취미 */}
      <div className="mb-5">
        <p className="text-xs text-gray-400 mb-2">취미 <span className="text-gray-300">(최대 5개)</span></p>
        <div className="flex flex-wrap gap-2">
          {HOBBIES.map(h => (
            <button key={h} onClick={() => toggle('hobbies', h, 5)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                ${form.hobbies.includes(h) ? 'bg-[#0f0f0f] text-white border-[#0f0f0f]' : 'bg-white text-gray-500 border-gray-200'}`}>
              {h}
            </button>
          ))}
        </div>
      </div>

      {/* 부산 데이트 스타일 */}
      <div className="mb-5">
        <p className="text-xs text-gray-400 mb-2">부산 데이트 스타일 <span className="text-gray-300">(최대 3개)</span></p>
        <div className="flex flex-wrap gap-2">
          {BUSAN_DATE_STYLES.map(s => (
            <button key={s} onClick={() => toggle('dateStyles', s, 3)}
              className={`text-xs px-3 py-2 rounded-2xl border transition-colors
                ${form.dateStyles.includes(s) ? 'bg-[#0f0f0f] text-white border-[#0f0f0f]' : 'bg-white text-gray-500 border-gray-200'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 주로 활동하는 구 */}
      <div className="mb-5">
        <p className="text-xs text-gray-400 mb-2">주로 활동하는 구</p>
        <div className="flex flex-wrap gap-2">
          {BUSAN_DISTRICTS.map(d => (
            <button key={d} onClick={() => setForm(f => ({ ...f, busanDistrict: d }))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                ${form.busanDistrict === d ? 'bg-[#0f0f0f] text-white border-[#0f0f0f]' : 'bg-white text-gray-500 border-gray-200'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* 연락 빈도 */}
      <div className="mb-5">
        <p className="text-xs text-gray-400 mb-2">선호 연락 빈도</p>
        <div className="flex flex-col gap-2">
          {CONTACT_FREQ.map(c => (
            <button key={c} onClick={() => setForm(f => ({ ...f, contactFreq: c }))}
              className={`text-xs px-4 py-3 rounded-xl border text-left transition-colors
                ${form.contactFreq === c ? 'bg-[#0f0f0f] text-white border-[#0f0f0f]' : 'bg-white text-gray-600 border-gray-100'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 자기소개 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-gray-400">자기소개</p>
          <p className={`text-xs ${form.selfIntro.length >= 50 ? 'text-green-500' : 'text-gray-300'}`}>
            {form.selfIntro.length}/50+
          </p>
        </div>
        <textarea value={form.selfIntro}
          onChange={e => setForm(f => ({ ...f, selfIntro: e.target.value }))}
          placeholder="나를 자유롭게 소개해 주세요. 부산에서의 일상이나 취미 이야기도 좋아요 😊"
          rows={4}
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     outline-none focus:border-gray-300 resize-none transition-colors" />
        <div className="w-full h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${form.selfIntro.length >= 50 ? 'bg-green-400' : 'bg-gray-300'}`}
            style={{ width: `${Math.min((form.selfIntro.length / 50) * 100, 100)}%` }} />
        </div>
      </div>

      <button onClick={onNext} disabled={!canNext}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   disabled:opacity-30 active:scale-[0.98] transition-all mb-8">
        가입 완료 🎉
      </button>
    </div>
  );
}

// ── STEP 5: 완료 화면 ─────────────────────────────────────
function StepDone({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 text-center">
      <div className="text-5xl mb-5">🎉</div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-3">가입 완료!</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-8">
        다음 단계로 <strong>직장 인증 서류</strong>를 제출하고<br />
        <strong>보증금 5만원</strong>을 결제하면<br />
        매칭이 시작됩니다 ✨
      </p>

      <div className="w-full bg-gray-50 rounded-2xl p-4 mb-8 text-left">
        {[
          { step: '1', label: '서류 인증 제출', sub: '직장 이메일 · 명함 · 소득 증빙(선택)', done: false },
          { step: '2', label: '관리자 승인', sub: '영업일 1~2일 소요', done: false },
          { step: '3', label: '보증금 결제', sub: '5만원 · 3회 만남 미달 시 전액 환불', done: false },
          { step: '4', label: '매칭 시작!', sub: '3rd Vibe팀이 직접 큐레이션합니다', done: false },
        ].map(s => (
          <div key={s.step} className="flex items-start gap-3 mb-3 last:mb-0">
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
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
  const [step, setStep] = useState<Step>('phone');
  const [e164Phone, setE164Phone] = useState('');
  const [form, setForm] = useState<FormData>({
    phone: '', otp: '',
    name: '', birthYear: '', gender: '', occupation: '', companyName: '',
    mbti: '', personalityTags: [], hobbies: [], dateStyles: [],
    contactFreq: '', relationshipGoal: '', busanDistrict: '', selfIntro: '',
  });

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
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

      {step === 'phone'  && <StepPhone  form={form} setForm={setForm} onNext={(e164) => { setE164Phone(e164); next(); }} />}
      {step === 'otp'    && <StepOTP    form={form} setForm={setForm} e164Phone={e164Phone} onNext={next} />}
      {step === 'basic'  && <StepBasic  form={form} setForm={setForm} onNext={next} />}
      {step === 'survey' && <StepSurvey form={form} setForm={setForm} onNext={next} />}
      {step === 'done'   && <StepDone   onContinue={() => router.push('/verify-docs')} />}
    </div>
  );
}
