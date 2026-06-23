'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint';
import { api } from '@/lib/api';
import type { IdType } from '@/lib/types';

// ── 진행 단계 바 ─────────────────────────────────────────
function ProgressBar({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${
            i < current ? 'bg-[#0f0f0f]' : i === current ? 'bg-[#0f0f0f]/30' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

// ── STEP 1: 신분증 선택 ──────────────────────────────────
function StepIdSelect({
  selected,
  onSelect,
  onNext,
}: {
  selected: IdType | null;
  onSelect: (t: IdType) => void;
  onNext: () => void;
}) {
  const options: { type: IdType; label: string; sub: string; icon: string }[] = [
    { type: 'passport', label: '여권', sub: '한국 여권', icon: '🛂' },
    { type: 'id_card', label: '주민등록증', sub: '대한민국 주민등록증', icon: '🪪' },
  ];

  return (
    <div className="flex flex-col flex-1">
      <p className="text-xs text-gray-400 mb-1">신원 인증 1/3</p>
      <h2 className="text-lg font-medium text-gray-900 mb-1">신분증을 선택해 주세요</h2>
      <p className="text-xs text-gray-400 leading-relaxed mb-6">
        인증 정보는 매칭 목적으로만 사용되며<br />제3자에게 공유되지 않습니다.
      </p>

      <div className="flex flex-col gap-3 flex-1">
        {options.map((opt) => (
          <button
            key={opt.type}
            onClick={() => onSelect(opt.type)}
            className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all
              ${selected === opt.type
                ? 'border-[#0f0f0f] border-[1.5px]'
                : 'border-gray-200 hover:border-gray-300'}`}
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg">
              {opt.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{opt.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center
                ${selected === opt.type ? 'border-[#0f0f0f] bg-[#0f0f0f]' : 'border-gray-300'}`}
            >
              {selected === opt.type && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        disabled={!selected}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   disabled:opacity-30 active:scale-[0.98] transition-all mt-6"
      >
        다음 단계
      </button>
    </div>
  );
}

// ── STEP 2: 문서 스캔 (Sumsub SDK 연동 자리) ─────────────
function StepDocScan({ idType, onNext }: { idType: IdType; onNext: () => void }) {
  const [scanning, setScanning] = useState(false);

  const handleScan = () => {
    setScanning(true);
    // 실제 구현: Sumsub Web SDK 호출
    // SumsubWebSDK.init({ applicantId, accessToken, ... })
    setTimeout(() => {
      setScanning(false);
      onNext();
    }, 2000);
  };

  return (
    <div className="flex flex-col flex-1">
      <p className="text-xs text-gray-400 mb-1">신원 인증 2/3</p>
      <h2 className="text-lg font-medium text-gray-900 mb-1">
        {idType === 'passport' ? '여권을 촬영해 주세요' : '신분증을 촬영해 주세요'}
      </h2>
      <p className="text-xs text-gray-400 leading-relaxed mb-6">
        밝은 곳에서 신분증 전체가 화면에 들어오도록 촬영해 주세요.
      </p>

      {/* 스캔 가이드 박스 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-full aspect-[1.58/1] border-2 border-dashed border-gray-300 rounded-2xl
                        flex flex-col items-center justify-center gap-3 bg-gray-50">
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-2xl">
            {idType === 'passport' ? '🛂' : '🪪'}
          </div>
          <p className="text-xs text-gray-400 text-center">
            신분증을 이 영역 안에 맞춰주세요<br />
            <span className="text-gray-300">모서리 4개가 모두 보여야 합니다</span>
          </p>
        </div>

        <div className="w-full bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-xs text-amber-700 leading-relaxed">
            ⚠️ 주의: 반사광, 그림자, 손가락이 가리는 경우 인식이 어려울 수 있습니다.
          </p>
        </div>
      </div>

      <button
        onClick={handleScan}
        disabled={scanning}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   disabled:opacity-50 active:scale-[0.98] transition-all mt-6"
      >
        {scanning ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            인식 중...
          </span>
        ) : '촬영 시작'}
      </button>
    </div>
  );
}

// ── STEP 3: Liveness (실시간 얼굴 인증) ──────────────────
function StepLiveness({ onComplete }: { onComplete: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [instructionIdx, setInstructionIdx] = useState(0);

  const instructions = ['정면을 바라봐 주세요', '천천히 고개를 끄덕여 주세요', '눈을 한 번 깜빡여 주세요'];

  useEffect(() => {
    let stream: MediaStream;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          setCamReady(true);
        }
      })
      .catch(() => setCamError(true));

    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const handleVerify = () => {
    setVerifying(true);
    // 실제 구현: Sumsub Liveness SDK 호출
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setInstructionIdx(step);
      if (step >= instructions.length) {
        clearInterval(interval);
        setTimeout(onComplete, 600);
      }
    }, 1200);
  };

  return (
    <div className="flex flex-col flex-1">
      <p className="text-xs text-gray-400 mb-1">신원 인증 3/3</p>
      <h2 className="text-lg font-medium text-gray-900 mb-1">얼굴 인증</h2>
      <p className="text-xs text-gray-400 leading-relaxed mb-4">
        신분증 사진과 본인이 동일인인지 확인합니다.
      </p>

      {/* 카메라 영역 */}
      <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-gray-900 flex items-center justify-center">
        {camError ? (
          <div className="text-center px-6">
            <p className="text-white/60 text-sm">카메라 권한이 필요합니다.</p>
            <p className="text-white/30 text-xs mt-1">설정에서 카메라 접근을 허용해 주세요.</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {/* 타원 오버레이 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`w-48 h-60 border-2 rounded-full transition-colors duration-500
                  ${verifying ? 'border-green-400' : 'border-white/40'}`}
              />
            </div>
            {/* 지시 문구 */}
            {verifying && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <div className="bg-black/60 text-white text-xs px-4 py-2 rounded-full">
                  {instructions[Math.min(instructionIdx, instructions.length - 1)]}
                </div>
              </div>
            )}
            {/* 녹화 표시 */}
            {verifying && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-xs">인증 중</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex-1" />

      <button
        onClick={handleVerify}
        disabled={!camReady || verifying}
        className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                   disabled:opacity-30 active:scale-[0.98] transition-all mt-4"
      >
        {verifying ? '인증 중...' : '얼굴 인증 시작'}
      </button>
    </div>
  );
}

// ── 메인: KYC 플로우 페이지 ──────────────────────────────
export default function VerifyPage() {
  const router = useRouter();
  const { visitorId } = useDeviceFingerprint();
  const [step, setStep] = useState(0);
  const [idType, setIdType] = useState<IdType | null>(null);
  const [banned, setBanned] = useState(false);

  // 기기 차단 여부 사전 확인
  useEffect(() => {
    if (!visitorId) return;
    api.device.check(visitorId).then((res) => {
      if (res.is_banned) setBanned(true);
    }).catch(() => {});
  }, [visitorId]);

  const handleVerifyComplete = async () => {
    try {
      if (visitorId) {
        await api.verification.start(
          { user_id: 'user_' + Date.now(), device_fingerprint: visitorId, id_type: 'passport' },
          visitorId
        );
      }
    } catch (e) {
      // 에러 무시하고 다음 단계로 (실제 서비스에서는 처리 필요)
    }
    router.push('/profile/setup');
  };

  if (banned) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-4">🚫</div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">이용 불가 기기</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          이 기기는 정책 위반으로 인해<br />서비스 이용이 영구 차단되었습니다.
        </p>
        <p className="text-xs text-gray-400 mt-4">문의: support@realbridge.app</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-6 pt-14 pb-8">
      {/* 뒤로가기 */}
      <button
        onClick={() => (step > 0 ? setStep((s) => s - 1) : router.back())}
        className="absolute top-6 left-6 w-8 h-8 flex items-center justify-center text-gray-500"
        aria-label="뒤로가기"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <ProgressBar total={3} current={step} />

      {step === 0 && (
        <StepIdSelect
          selected={idType}
          onSelect={setIdType}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && idType && (
        <StepDocScan idType={idType} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <StepLiveness onComplete={handleVerifyComplete} />
      )}
    </div>
  );
}
