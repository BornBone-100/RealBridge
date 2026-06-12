'use client';

/**
 * ProtectedView
 * =============
 * 워터마크를 자동으로 적용하는 래퍼 컴포넌트.
 * 프로필 카드, 채팅창, 사진 뷰어 등 민감한 콘텐츠를 감쌀 때 사용합니다.
 *
 * 사용 예시:
 *   <ProtectedView userId="user_abc123">
 *     <ProfileCard ... />
 *   </ProtectedView>
 */

import { ReactNode } from 'react';
import Watermark from './Watermark';

interface ProtectedViewProps {
  /** 현재 로그인한 유저 ID (워터마크에 표시) */
  userId: string;
  children: ReactNode;
  className?: string;
  /** 워터마크 투명도 조절 (기본 0.12) */
  watermarkOpacity?: number;
}

export default function ProtectedView({
  userId,
  children,
  className = '',
  watermarkOpacity,
}: ProtectedViewProps) {
  return (
    <div
      className={`relative select-none ${className}`}
      // 브라우저 기본 드래그/저장 방지 (보조적 방어)
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
      <Watermark userId={userId} opacity={watermarkOpacity} />
    </div>
  );
}
