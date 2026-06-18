'use client';

/**
 * useScreenCaptureGuard
 * =====================
 * 스크린 캡처 억제 훅.
 *
 * 감지 범위:
 *   - PrintScreen / PrtSc 키
 *   - macOS 스크린샷 단축키: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
 *   - 탭 visibility 변경 (캡처 도구 전환 등)
 *   - 창 포커스 상실 (Alt+Tab 등)
 *
 * 동작:
 *   - 캡처 감지 시: isCapturing = true → 0.4초 후 해제
 *   - 탭 숨김 시: isHidden = true → 탭 복귀 시 해제
 *
 * 한계:
 *   - OS 레벨 캡처는 완전히 막을 수 없음 (목표는 억제 + 워터마크 역추적)
 *   - 물리적 카메라, 외부 녹화 도구는 감지 불가
 */

import { useEffect, useState, useCallback } from 'react';

interface ScreenCaptureGuardState {
  /** 캡처 키 입력 감지됨 (0.4초 플래시용) */
  isCapturing: boolean;
  /** 탭/창이 숨겨진 상태 */
  isHidden: boolean;
}

export default function useScreenCaptureGuard(): ScreenCaptureGuardState {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const triggerCapture = useCallback(() => {
    setIsCapturing(true);
    setTimeout(() => setIsCapturing(false), 400);
  }, []);

  useEffect(() => {
    // ── 키보드 단축키 감지 ──────────────────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // PrintScreen
      if (e.key === 'PrintScreen' || e.key === 'Print') {
        e.preventDefault();
        triggerCapture();
        return;
      }

      // macOS: Cmd+Shift+3 / Cmd+Shift+4 / Cmd+Shift+5
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        if (key === '3' || key === '4' || key === '5') {
          e.preventDefault();
          triggerCapture();
          return;
        }
      }

      // Windows Snipping Tool: Win+Shift+S → 브라우저에서는 감지 제한적
      // Ctrl+P (인쇄 → 스크린샷 우회)
      if ((e.ctrlKey || e.metaKey) && key === 'p') {
        e.preventDefault();
      }
    };

    // ── 탭/창 visibility 변경 감지 ─────────────────────────
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsHidden(true);
      } else {
        setIsHidden(false);
      }
    };

    // ── 창 포커스 상실 감지 ────────────────────────────────
    const handleBlur = () => setIsHidden(true);
    const handleFocus = () => setIsHidden(false);

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [triggerCapture]);

  return { isCapturing, isHidden };
}
