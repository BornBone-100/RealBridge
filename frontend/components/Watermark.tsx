'use client';

/**
 * Watermark — Canvas 기반 반투명 워터마크
 * =========================================
 * 보안 설계:
 *
 * 1. Canvas 렌더링
 *    - DOM에 텍스트 노드가 없어 단순 CSS hidden/display:none으로 제거 불가
 *    - 이미지로 변환된 data URL을 background-image로 적용 → 텍스트 선택/검색 불가
 *
 * 2. MutationObserver 감시
 *    - 개발자 도구로 워터마크 요소를 삭제하거나 style을 변경하면 즉시 재삽입
 *    - 부모 컨테이너도 감시 → 컨테이너 자체를 지워도 복원
 *
 * 3. pointer-events: none + z-index
 *    - 워터마크 위에서 정상 UI 조작 가능
 *    - z-index를 충분히 높게 설정해 스크린샷에 포함
 *
 * 4. 사용자 식별
 *    - 현재 유저 ID/닉네임 + 타임스탬프를 워터마크에 포함
 *    - 유출 사고 발생 시 어느 계정에서 캡처됐는지 역추적 가능
 *
 * 한계 (완전한 방어는 불가):
 *    - 외부 화면 녹화 도구(물리적 카메라 등)는 막을 수 없음
 *    - 브라우저 확장 프로그램(MV3 이전)은 Canvas를 조작할 수 있음
 *    - 목표는 "도용을 어렵게 + 역추적 가능하게" 만드는 것
 */

import { useEffect, useRef, useCallback } from 'react';

interface WatermarkProps {
  /** 워터마크에 표시할 사용자 식별자 (ID 또는 닉네임) */
  userId: string;
  /** 워터마크 투명도 (0~1, 기본 0.12) */
  opacity?: number;
  /** 워터마크 회전 각도 (기본 -25도) */
  rotate?: number;
  /** 글꼴 크기 (기본 13) */
  fontSize?: number;
  /** 타임스탬프 포함 여부 (기본 true) — 유출 시 역추적용 */
  includeTimestamp?: boolean;
}

function generateWatermarkDataUrl({
  userId,
  opacity,
  rotate,
  fontSize,
  includeTimestamp,
}: Required<WatermarkProps>): string {
  // 워터마크 패턴 한 칸의 크기 (canvas tile)
  const TILE_W = 240;
  const TILE_H = 140;

  const canvas = document.createElement('canvas');
  canvas.width  = TILE_W;
  canvas.height = TILE_H;
  const ctx = canvas.getContext('2d')!;

  // 배경 투명
  ctx.clearRect(0, 0, TILE_W, TILE_H);

  // 중앙 기준으로 회전
  ctx.save();
  ctx.translate(TILE_W / 2, TILE_H / 2);
  ctx.rotate((rotate * Math.PI) / 180);

  ctx.globalAlpha = opacity;
  ctx.fillStyle   = '#000000';
  ctx.font        = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';

  // 줄 1: 유저 식별자
  ctx.fillText(userId, 0, includeTimestamp ? -10 : 0);

  // 줄 2: 타임스탬프 (YYYY-MM-DD HH:mm)
  if (includeTimestamp) {
    const now = new Date();
    const ts  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} `
              + `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    ctx.font = `${fontSize - 2}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.globalAlpha = opacity * 0.75;
    ctx.fillText(ts, 0, 12);
  }

  ctx.restore();

  return canvas.toDataURL('image/png');
}

export default function Watermark({
  userId,
  opacity = 0.12,
  rotate  = -25,
  fontSize = 13,
  includeTimestamp = true,
}: WatermarkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLDivElement>(null);
  const observerRef  = useRef<MutationObserver | null>(null);

  /** 워터마크 div를 (재)생성하여 container에 삽입 */
  const mountWatermark = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // 기존 워터마크 제거 후 재삽입
    const existing = container.querySelector('[data-wm="1"]');
    if (existing) existing.remove();

    const dataUrl = generateWatermarkDataUrl({
      userId,
      opacity,
      rotate,
      fontSize,
      includeTimestamp,
    });

    const el = document.createElement('div');
    el.setAttribute('data-wm', '1');

    // ── CSS 방어 ────────────────────────────────────────────
    Object.assign(el.style, {
      position:        'absolute',
      inset:           '0',
      width:           '100%',
      height:          '100%',
      // Canvas → data URL → background-image (텍스트 노드 없음)
      backgroundImage: `url(${dataUrl})`,
      backgroundRepeat:'repeat',
      backgroundSize:  '240px 140px',
      pointerEvents:   'none',      // UI 조작 방해 없음
      zIndex:          '9999',
      userSelect:      'none',
      // visibility/opacity를 인라인으로 강제 — !important 외부 CSS 방어
      opacity:         '1',
      visibility:      'visible',
      display:         'block',
    });

    // 추가 방어: CSS 변수 오버라이드를 막기 위해 style attribute를
    // Object.defineProperty로 덮어쓰기 시도를 감지 (브라우저 지원 범위 내)
    try {
      Object.defineProperty(el, 'style', {
        configurable: false,
        writable:     false,
      });
    } catch {
      // 일부 환경에서 실패할 수 있으므로 무시
    }

    container.appendChild(el);
    (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  }, [userId, opacity, rotate, fontSize, includeTimestamp]);

  /** MutationObserver 설정 — DOM 조작 감지 후 워터마크 복원 */
  const startObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // 워터마크 요소가 삭제됐는지 확인
        const removed = Array.from(mutation.removedNodes).some(
          (node) => (node as HTMLElement).getAttribute?.('data-wm') === '1'
        );
        // 워터마크 속성/스타일이 변경됐는지 확인
        const isWmTarget =
          mutation.type === 'attributes' &&
          (mutation.target as HTMLElement).getAttribute?.('data-wm') === '1';

        if (removed || isWmTarget) {
          // 즉시 재삽입
          mountWatermark();
          return;
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList:  true,   // 자식 추가/삭제 감지
        subtree:    true,   // 하위 트리 전체
        attributes: true,   // 속성 변경 감지
        attributeFilter: ['style', 'class', 'data-wm'],
      });
    }

    observerRef.current = observer;
  }, [mountWatermark]);

  useEffect(() => {
    mountWatermark();
    startObserver();

    // 탭 포커스 복귀 시 타임스탬프 갱신 (스크린샷 찍기 어렵게)
    const onFocus = () => mountWatermark();
    window.addEventListener('focus', onFocus);

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener('focus', onFocus);
    };
  }, [mountWatermark, startObserver]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset:    '0',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex:   9998,
      }}
      aria-hidden="true"
    />
  );
}
