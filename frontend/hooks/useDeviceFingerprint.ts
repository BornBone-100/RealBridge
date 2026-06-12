/**
 * useDeviceFingerprint
 *
 * FingerprintJS Pro를 사용해 기기 고유 ID(visitorId)를 가져오는 훅.
 * 이 ID는 모든 인증 요청의 X-Device-Fingerprint 헤더에 포함됩니다.
 *
 * 설치:
 *   npm install @fingerprintjs/fingerprintjs-pro
 *
 * FingerprintJS Pro 대시보드에서 API 키를 발급받아
 * NEXT_PUBLIC_FPJS_API_KEY 환경변수에 설정하세요.
 */

import { useEffect, useState } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs-pro';

interface FingerprintState {
  visitorId: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useDeviceFingerprint(): FingerprintState {
  const [state, setState] = useState<FingerprintState>({
    visitorId: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const fp = await FingerprintJS.load({
          apiKey: process.env.NEXT_PUBLIC_FPJS_API_KEY!,
        });
        const result = await fp.get();

        if (!cancelled) {
          setState({ visitorId: result.visitorId, isLoading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ visitorId: null, isLoading: false, error: 'Device identification failed.' });
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return state;
}
