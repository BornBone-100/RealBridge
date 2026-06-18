'use client';

/**
 * ProtectedView
 * =============
 * 워터마크 + 스크린 캡처 억제 래퍼 컴포넌트.
 *
 * 방어 레이어:
 *   1. Canvas 워터마크 (MutationObserver 감시)
 *   2. 우클릭 / 드래그 방지
 *   3. PrintScreen / macOS 스크린샷 단축키 감지 → 0.4초 블랙아웃
 *   4. 탭 숨김 / 창 포커스 상실 감지 → 블러 처리
 *   5. "캡처 금지" 안내 배너 (선택적)
 */

import { ReactNode } from 'react';
import Watermark from './Watermark';
import useScreenCaptureGuard from '@/hooks/useScreenCaptureGuard';

interface ProtectedViewProps {
  /** 현재 로그인한 유저 ID (워터마크에 표시) */
  userId: string;
  children: ReactNode;
  className?: string;
  /** 워터마크 투명도 조절 (기본 0.12) */
  watermarkOpacity?: number;
  /** 하단 캡처 금지 배너 표시 여부 (기본 false) */
  showBanner?: boolean;
}

export default function ProtectedView({
  userId,
  children,
  className = '',
  watermarkOpacity,
  showBanner = false,
}: ProtectedViewProps) {
  const { isCapturing, isHidden } = useScreenCaptureGuard();

  return (
    <div
      className={`relative select-none ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* 실제 콘텐츠 — 탭 숨김 시 블러 */}
      <div
        style={{
          filter: isHidden ? 'blur(18px)' : 'none',
          transition: 'filter 0.15s ease',
          pointerEvents: isHidden ? 'none' : undefined,
        }}
      >
        {children}
      </div>

      {/* 워터마크 레이어 */}
      <Watermark userId={userId} opacity={watermarkOpacity} />

      {/* 캡처 감지 시 블랙아웃 플래시 */}
      {isCapturing && (
        <div
          style={{
            position:        'absolute',
            inset:           '0',
            backgroundColor: '#000000',
            zIndex:          99999,
            pointerEvents:   'none',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
          }}
        >
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600, opacity: 0.85 }}>
            📵 화면 캡처가 제한된 영역입니다
          </span>
        </div>
      )}

      {/* 탭 숨김 시 블러 오버레이 안내 */}
      {isHidden && (
        <div
          style={{
            position:        'absolute',
            inset:           '0',
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex:          99998,
            pointerEvents:   'none',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
          }}
        >
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
            🔒 앱으로 돌아오면 사진이 표시됩니다
          </span>
        </div>
      )}

      {/* 캡처 금지 안내 배너 (선택적) */}
      {showBanner && (
        <div
          style={{
            position:        'absolute',
            bottom:          0,
            left:            0,
            right:           0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            color:           '#fff',
            fontSize:        '11px',
            textAlign:       'center',
            padding:         '4px 8px',
            zIndex:          9997,
            pointerEvents:   'none',
            letterSpacing:   '0.02em',
          }}
        >
          📵 사진 무단 캡처·배포 시 법적 책임이 발생할 수 있습니다
        </div>
      )}
    </div>
  );
}
