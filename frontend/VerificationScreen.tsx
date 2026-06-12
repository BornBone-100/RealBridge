/**
 * VerificationScreen
 *
 * 변경 사항:
 *  1. useDeviceFingerprint 훅으로 기기 지문을 수집
 *  2. 가입 전 /api/device/check 로 차단 여부 사전 확인
 *  3. KYC 시작 요청에 X-Device-Fingerprint 헤더 포함
 *  4. Rate Limit(429) 응답 처리 — Retry-After 안내
 */

import { useState, useEffect } from 'react';
import { useDeviceFingerprint } from './hooks/useDeviceFingerprint';

interface Props {
  userId: string;
}

type ScreenState = 'idle' | 'checking_device' | 'loading' | 'success' | 'banned_device' | 'rate_limited' | 'error';

export default function VerificationScreen({ userId }: Props) {
  const { visitorId, isLoading: fpLoading, error: fpError } = useDeviceFingerprint();
  const [screen, setScreen] = useState<ScreenState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);

  // 컴포넌트 마운트 시 기기 차단 여부 사전 확인
  useEffect(() => {
    if (!visitorId) return;

    const checkDevice = async () => {
      setScreen('checking_device');
      try {
        const res = await fetch('/api/device/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_fingerprint: visitorId }),
        });
        const data = await res.json();

        if (data.is_banned) {
          setScreen('banned_device');
        } else {
          setScreen('idle');
        }
      } catch {
        setScreen('idle'); // 사전 확인 실패 시 진행 허용 (서버에서 다시 검증)
      }
    };

    checkDevice();
  }, [visitorId]);

  const startKycProcess = async () => {
    if (!visitorId) {
      setErrorMessage('기기 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setScreen('error');
      return;
    }

    setScreen('loading');

    try {
      const res = await fetch('/api/verification/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': visitorId,  // ★ 기기 지문 헤더
        },
        body: JSON.stringify({ user_id: userId, device_fingerprint: visitorId }),
      });

      if (res.status === 429) {
        // Rate Limit 초과
        const retryAfterSec = parseInt(res.headers.get('Retry-After') || '60', 10);
        setRetryAfter(retryAfterSec);
        setScreen('rate_limited');
        return;
      }

      if (res.status === 403) {
        setScreen('banned_device');
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setErrorMessage(data.detail || '오류가 발생했습니다.');
        setScreen('error');
        return;
      }

      // ✅ 성공 — Sumsub SDK 호출 (실제 연동 시 아래 주석 해제)
      // await SumsubWebSDK.init({ userId, ... });
      setScreen('success');

    } catch {
      setErrorMessage('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.');
      setScreen('error');
    }
  };

  // ── 기기 차단 화면 ─────────────────────────────────────
  if (screen === 'banned_device') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white">
        <div className="text-red-500 text-5xl mb-4">🚫</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">이용 불가 기기</h1>
        <p className="text-gray-600 text-center text-sm">
          이 기기는 정책 위반으로 인해 서비스 이용이 영구 차단되었습니다.
          <br />문의: support@realbridge.app
        </p>
      </div>
    );
  }

  // ── Rate Limit 화면 ────────────────────────────────────
  if (screen === 'rate_limited') {
    const minutes = Math.ceil(retryAfter / 60);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white">
        <div className="text-yellow-500 text-5xl mb-4">⏳</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">잠시 후 다시 시도해 주세요</h1>
        <p className="text-gray-600 text-center text-sm">
          인증 시도 횟수를 초과했습니다.
          <br />약 <strong>{minutes}분</strong> 후에 다시 시도할 수 있습니다.
        </p>
      </div>
    );
  }

  // ── 메인 화면 ──────────────────────────────────────────
  const isButtonDisabled = fpLoading || screen === 'checking_device' || screen === 'loading';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-white">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">
        진짜 인연을 위한 마지막 단계
      </h1>
      <p className="text-gray-600 text-center mb-8">
        저희 앱은 사기 계정 0%를 지향합니다.
        <br />안전한 글로벌 매칭을 위해 여권 또는 신분증 인증을 진행해 주세요.
      </p>

      <div className="bg-blue-50 p-4 rounded-lg w-full max-w-sm mb-6">
        <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
          <li>인증된 정보는 매칭 용도로만 사용됩니다.</li>
          <li>실시간 셀프 카메라 촬영이 필요합니다.</li>
          <li>1인 1기기 원칙이 적용됩니다.</li>
        </ul>
      </div>

      {screen === 'error' && (
        <p className="text-red-500 text-sm mb-4 text-center">{errorMessage}</p>
      )}

      {fpError && (
        <p className="text-yellow-600 text-xs mb-3 text-center">
          기기 식별에 실패했습니다. 인증은 계속 진행할 수 있습니다.
        </p>
      )}

      <button
        onClick={startKycProcess}
        disabled={isButtonDisabled}
        className="w-full max-w-sm bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {screen === 'checking_device' ? '기기 확인 중...'
          : screen === 'loading' ? '인증 준비 중...'
          : screen === 'success' ? '✅ 인증 시작됨'
          : '신원 인증 시작하기'}
      </button>
    </div>
  );
}
