'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ── 타입 ──────────────────────────────────────────────────
type Step = 'country' | 'phone' | 'otp' | 'kyc' | 'profile';
type Nationality = 'KR' | 'JP' | 'TW';

interface FormData {
  nationality: Nationality | null;
  phone: string;
  otp: string;
  // 프로필
  name: string;
  age: string;
  bio: string;
  datingValues: string;
  interests: string[];
}

// ── 상수 ──────────────────────────────────────────────────
const COUNTRIES: { code: Nationality; flag: string; label: string; dialCode: string }[] = [
  { code: 'KR', flag: '🇰🇷', label: '한국', dialCode: '+82' },
  { code: 'JP', flag: '🇯🇵', label: '일본', dialCode: '+81' },
  { code: 'TW', flag: '🇹🇼', label: '대만', dialCode: '+886' },
];

const ALL_INTERESTS = ['여행', '커피', '음악', '요리', '영화', '독서', '게임', '스포츠', '사진', '드라마', 'K-pop', '맛집'];

const STEPS: Step[] = ['country', 'phone', 'otp', 'kyc', 'profile'];

// ── 진행 바 ───────────────────────────────────────────────
function ProgressBar({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  const pct = Math.round(((idx + 1) / STEPS.length) * 100);
  return (
    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-[#0f0f0f] rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── 국가 선택 ─────────────────────────────────────────────
function StepCountry({ onNext, form, setForm }: {
  onNext: () => void;
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  return (
    <div className="flex flex-col flex-1 px-6 pt-8">
      <h2 className="text-2xl font-medium text-gray-900 mb-2 tracking-tight">어느 나라에서 오셨나요?</h2>
      <p className="text-sm text-gray-400 mb-8">본인 국적을 선택해 주세요</p>

      <div className="flex flex-col gap-3 mb-8">
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            onClick={() => setForm((f) => ({ ...f, nationality: c.code }))}
            className={`flex items-center gap-4 px-5 py-4 rounded-2xl border-[1.5px] transition-all active:scale-[0.98]
              ${form.nationality === c.code
                ? 'border-[#0f0f0f] bg-[#0f0f0f]'
                : 'border-gray-100 bg-gray-50'}`}
          >
            <span className="text-3xl">{c.flag}</span>
            <div className="text-left">
              <p className={`text-sm font-medium ${form.nationality === c.code ? 'text-white' : 'text-gray-900'}`}>
                {c.label}
              </p>
              <p className={`text-xs ${form.nationality === c.code ? 'text-white/60' : 'text-gray-400'}`}>
                {c.dialCode}
              </p>
            </div>
            {form.nationality === c.code && (
              <div className="ml-auto">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        disabled={!form.nationality}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   disabled:opacity-30 active:scale-[0.98] transition-all mt-auto mb-8"
      >
        계속하기
      </button>
    </div>
  );
}

// ── 전화번호 입력 ─────────────────────────────────────────
function StepPhone({ onNext, form, setForm }: {
  onNext: () => void;
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  const country = COUNTRIES.find((c) => c.code === form.nationality)!;
  const isValid = form.phone.replace(/\D/g, '').length >= 9;

  return (
    <div className="flex flex-col flex-1 px-6 pt-8">
      <h2 className="text-2xl font-medium text-gray-900 mb-2 tracking-tight">전화번호를 입력해 주세요</h2>
      <p className="text-sm text-gray-400 mb-8">
        본인 명의 번호만 사용 가능합니다. 가상 번호는 차단됩니다.
      </p>

      <div className="flex gap-2 mb-3">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 flex-shrink-0">
          <span className="text-xl">{country.flag}</span>
          <span className="text-sm text-gray-700">{country.dialCode}</span>
        </div>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="전화번호 입력"
          className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm text-gray-900
                     placeholder-gray-300 outline-none focus:border-gray-300 transition-colors"
        />
      </div>

      <p className="text-xs text-gray-300 mb-8">
        인증 문자(SMS)가 발송됩니다
      </p>

      <button
        onClick={onNext}
        disabled={!isValid}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   disabled:opacity-30 active:scale-[0.98] transition-all mt-auto mb-8"
      >
        인증번호 받기
      </button>
    </div>
  );
}

// ── OTP 입력 ──────────────────────────────────────────────
function StepOTP({ onNext, form, setForm }: {
  onNext: () => void;
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = form.otp.split('').concat(Array(6).fill('')).slice(0, 6);

  const handleDigit = (idx: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const next = digits.slice();
    next[idx] = clean;
    setForm((f) => ({ ...f, otp: next.join('') }));
    if (clean && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const isValid = form.otp.replace(/\D/g, '').length === 6;

  return (
    <div className="flex flex-col flex-1 px-6 pt-8">
      <h2 className="text-2xl font-medium text-gray-900 mb-2 tracking-tight">인증번호를 입력해 주세요</h2>
      <p className="text-sm text-gray-400 mb-8">
        {form.phone}으로 발송된 6자리 번호를 입력하세요
      </p>

      {/* OTP 입력 박스 */}
      <div className="flex gap-2 justify-between mb-6">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="tel"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            className={`w-12 h-14 text-center text-xl font-medium rounded-2xl border-[1.5px] outline-none transition-colors
              ${d ? 'border-[#0f0f0f] text-gray-900' : 'border-gray-100 bg-gray-50 text-gray-900'}
              focus:border-gray-400`}
          />
        ))}
      </div>

      <p className="text-xs text-gray-300 mb-8">
        <button className="underline text-gray-400">인증번호 재발송</button>
        <span> (30초 후 가능)</span>
      </p>

      <button
        onClick={onNext}
        disabled={!isValid}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   disabled:opacity-30 active:scale-[0.98] transition-all mt-auto mb-8"
      >
        인증 완료
      </button>
    </div>
  );
}

// ── KYC (신분증 + 셀카) ───────────────────────────────────
function StepKYC({ onNext }: { onNext: () => void }) {
  const [kycStep, setKycStep] = useState<'intro' | 'id' | 'selfie' | 'done'>('intro');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch {
      alert('카메라 접근 권한이 필요합니다.');
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach((t) => t.stop());
    setStreaming(false);
  };

  useEffect(() => {
    if (kycStep === 'selfie') startCamera();
    else if (streaming) stopCamera();
  }, [kycStep]);

  if (kycStep === 'intro') return (
    <div className="flex flex-col flex-1 px-6 pt-8">
      <h2 className="text-2xl font-medium text-gray-900 mb-2 tracking-tight">본인 인증을 진행해요</h2>
      <p className="text-sm text-gray-400 mb-8 leading-relaxed">
        RealBridge는 진짜 사람만 만날 수 있도록<br />
        신분증과 실시간 셀카 인증을 요구합니다.
      </p>

      <div className="flex flex-col gap-3 mb-8">
        {[
          { emoji: '🪪', title: '신분증 촬영', desc: '여권 또는 주민등록증/운전면허증' },
          { emoji: '🤳', title: '실시간 셀카', desc: '얼굴이 선명하게 보이는 셀카' },
          { emoji: '✅', title: '심사 완료', desc: '보통 수 분 이내 완료' },
        ].map((s) => (
          <div key={s.title} className="flex items-center gap-4 bg-gray-50 rounded-2xl px-4 py-4">
            <span className="text-2xl">{s.emoji}</span>
            <div>
              <p className="text-sm font-medium text-gray-900">{s.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setKycStep('id')}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   active:scale-[0.98] transition-all mt-auto mb-8"
      >
        시작하기
      </button>
    </div>
  );

  if (kycStep === 'id') return (
    <div className="flex flex-col flex-1 px-6 pt-8">
      <h2 className="text-2xl font-medium text-gray-900 mb-2 tracking-tight">신분증을 촬영해 주세요</h2>
      <p className="text-sm text-gray-400 mb-6">여권 또는 신분증 전면이 선명하게 나와야 합니다</p>

      {/* 신분증 촬영 플레이스홀더 */}
      <div className="w-full aspect-[3/2] rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200
                      flex flex-col items-center justify-center mb-6">
        <span className="text-5xl mb-3">🪪</span>
        <p className="text-sm text-gray-400">신분증 앞면을 맞춰주세요</p>
        <p className="text-xs text-gray-300 mt-1">밝은 곳에서 촬영하면 더 잘 인식돼요</p>
      </div>

      <div className="flex gap-3 mt-auto mb-8">
        <button
          onClick={() => alert('카메라 촬영 기능은 SDK 연동 시 활성화됩니다')}
          className="flex-1 bg-gray-50 text-gray-700 rounded-2xl py-3.5 text-sm font-medium border border-gray-100"
        >
          직접 촬영
        </button>
        <button
          onClick={() => setKycStep('selfie')}
          className="flex-1 bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium"
        >
          완료 →
        </button>
      </div>
    </div>
  );

  if (kycStep === 'selfie') return (
    <div className="flex flex-col flex-1 px-6 pt-8">
      <h2 className="text-2xl font-medium text-gray-900 mb-2 tracking-tight">셀카를 찍어주세요</h2>
      <p className="text-sm text-gray-400 mb-4">타원 안에 얼굴을 맞추고 눈을 깜빡여 주세요</p>

      {/* 카메라 뷰 */}
      <div className="w-full aspect-[3/4] rounded-3xl bg-gray-900 overflow-hidden relative mb-6">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
        {/* 타원 오버레이 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-60 rounded-full border-2 border-white/60" />
        </div>
        {/* 지시문 */}
        <div className="absolute bottom-5 left-0 right-0 flex justify-center">
          <div className="bg-black/40 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full">
            눈을 2번 깜빡여 주세요
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-auto mb-8">
        <button
          onClick={() => { stopCamera(); setKycStep('id'); }}
          className="flex-1 bg-gray-50 text-gray-700 rounded-2xl py-3.5 text-sm font-medium border border-gray-100"
        >
          이전
        </button>
        <button
          onClick={() => { stopCamera(); setKycStep('done'); setTimeout(onNext, 800); }}
          className="flex-1 bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium"
        >
          촬영 완료
        </button>
      </div>
    </div>
  );

  // done — loading
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 gap-5">
      <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center">
        <svg className="w-6 h-6 text-gray-300 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
      <p className="text-sm text-gray-500">본인 인증 처리 중...</p>
    </div>
  );
}

// ── 프로필 설정 ───────────────────────────────────────────
function StepProfile({ onFinish, form, setForm }: {
  onFinish: () => void;
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  const toggleInterest = (tag: string) => {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(tag)
        ? f.interests.filter((i) => i !== tag)
        : f.interests.length < 5 ? [...f.interests, tag] : f.interests,
    }));
  };

  const bioLen = form.bio.length;
  const canSubmit = form.name.length >= 2 && form.age &&
    parseInt(form.age) >= 18 && bioLen >= 100 && form.datingValues.length >= 20;

  return (
    <div className="flex flex-col flex-1 px-6 pt-8 overflow-y-auto">
      <h2 className="text-2xl font-medium text-gray-900 mb-1 tracking-tight">프로필을 만들어요</h2>
      <p className="text-sm text-gray-400 mb-6">진정성 있는 소개글이 좋은 인연을 만들어요</p>

      {/* 사진 업로드 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200
                        flex flex-col items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-gray-300 mb-1" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
          <span className="text-[10px] text-gray-300">사진 추가</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          얼굴이 선명히 나온 사진을<br />2장 이상 등록해야 합니다.<br />
          선글라스·마스크 착용 불가
        </p>
      </div>

      {/* 이름 + 나이 */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="이름 (실명)"
          className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     placeholder-gray-300 outline-none focus:border-gray-300 transition-colors"
        />
        <input
          type="number"
          value={form.age}
          onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
          placeholder="나이"
          min="18" max="99"
          className="w-20 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     placeholder-gray-300 outline-none focus:border-gray-300 transition-colors"
        />
      </div>

      {/* 관심사 */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">관심사 (최대 5개)</p>
        <div className="flex flex-wrap gap-2">
          {ALL_INTERESTS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleInterest(tag)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                ${form.interests.includes(tag)
                  ? 'bg-[#0f0f0f] text-white border-[#0f0f0f]'
                  : 'bg-white text-gray-500 border-gray-200'}`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* 자기소개 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-gray-400">자기소개</p>
          <p className={`text-xs ${bioLen >= 100 ? 'text-green-500' : 'text-gray-300'}`}>
            {bioLen}/100+
          </p>
        </div>
        <textarea
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          placeholder="본인을 자유롭게 소개해 주세요. 최소 100자 이상 작성해야 합니다."
          rows={4}
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     placeholder-gray-300 outline-none focus:border-gray-300 transition-colors resize-none"
        />
        {/* 진행 바 */}
        <div className="w-full h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${bioLen >= 100 ? 'bg-green-400' : 'bg-gray-300'}`}
            style={{ width: `${Math.min((bioLen / 100) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* 연애관 */}
      <div className="mb-8">
        <p className="text-xs text-gray-400 mb-1.5">연애관 / 바라는 미래</p>
        <textarea
          value={form.datingValues}
          onChange={(e) => setForm((f) => ({ ...f, datingValues: e.target.value }))}
          placeholder="장거리 연애에 대한 생각, 바라는 관계 등을 적어주세요"
          rows={3}
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-sm
                     placeholder-gray-300 outline-none focus:border-gray-300 transition-colors resize-none"
        />
      </div>

      <button
        onClick={onFinish}
        disabled={!canSubmit}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   disabled:opacity-30 active:scale-[0.98] transition-all mb-8"
      >
        RealBridge 시작하기 🎉
      </button>
    </div>
  );
}

// ── 메인 온보딩 ───────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('country');
  const [form, setForm] = useState<FormData>({
    nationality: null,
    phone: '',
    otp: '',
    name: '',
    age: '',
    bio: '',
    datingValues: '',
    interests: [],
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

  const finish = () => {
    // TODO: 실제 API 호출 후 홈으로 이동
    router.replace('/home');
  };

  const STEP_LABELS: Record<Step, string> = {
    country: '국가 선택',
    phone: '전화번호',
    otp: 'OTP 인증',
    kyc: '본인 인증',
    profile: '프로필',
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 상단 네비 */}
      <div className="flex items-center gap-4 px-6 pt-14 pb-4">
        <button onClick={back} className="w-8 h-8 flex items-center justify-center -ml-1">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex-1">
          <ProgressBar current={step} />
        </div>
        <span className="text-xs text-gray-300 flex-shrink-0 w-16 text-right">
          {STEP_LABELS[step]}
        </span>
      </div>

      {/* 단계별 컨텐츠 */}
      {step === 'country' && <StepCountry onNext={next} form={form} setForm={setForm} />}
      {step === 'phone'   && <StepPhone   onNext={next} form={form} setForm={setForm} />}
      {step === 'otp'     && <StepOTP     onNext={next} form={form} setForm={setForm} />}
      {step === 'kyc'     && <StepKYC     onNext={next} />}
      {step === 'profile' && <StepProfile onFinish={finish} form={form} setForm={setForm} />}
    </div>
  );
}
