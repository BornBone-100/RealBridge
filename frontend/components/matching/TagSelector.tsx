'use client';

/**
 * TagSelector — 라이프스타일 태그 칩 선택 UI
 * ============================================
 * - 카테고리별 섹션으로 나눠 인지 부담 감소
 * - 최소/최대 선택 수 강제 + 진행 바로 피드백
 * - 이미 선택된 태그를 건드리면 즉시 해제 (토글)
 */

import { useState, useMemo } from 'react';

export interface Tag {
  id:       string;
  category: string;
  label:    string;  // 현재 언어에 맞는 라벨
}

interface TagSelectorProps {
  tags:         Tag[];
  selected:     string[];        // 선택된 tag id 배열
  onChange:     (ids: string[]) => void;
  minSelect?:   number;          // 최소 선택 수 (기본 3)
  maxSelect?:   number;          // 최대 선택 수 (기본 10)
}

const CATEGORY_META: Record<string, { emoji: string; label: string }> = {
  contact:   { emoji: '📱', label: '연락 스타일' },
  weekend:   { emoji: '🏖️', label: '주말 성향' },
  future:    { emoji: '🔭', label: '미래 계획' },
  values:    { emoji: '💡', label: '가치관' },
  lifestyle: { emoji: '🌿', label: '라이프스타일' },
  hobby:     { emoji: '🎨', label: '취미' },
};

export default function TagSelector({
  tags,
  selected,
  onChange,
  minSelect = 3,
  maxSelect = 10,
}: TagSelectorProps) {
  const grouped = useMemo(() => {
    const map: Record<string, Tag[]> = {};
    for (const tag of tags) {
      if (!map[tag.category]) map[tag.category] = [];
      map[tag.category].push(tag);
    }
    return map;
  }, [tags]);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (selected.length < maxSelect) {
      onChange([...selected, id]);
    }
  };

  const pct = Math.round((selected.length / maxSelect) * 100);
  const isUnder = selected.length < minSelect;

  return (
    <div className="flex flex-col gap-6">
      {/* 진행 상태 바 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">
            {isUnder
              ? `최소 ${minSelect}개 선택해 주세요`
              : `${selected.length}개 선택됨`}
          </span>
          <span className={`text-xs font-medium ${isUnder ? 'text-gray-300' : 'text-[#0f0f0f]'}`}>
            {selected.length}/{maxSelect}
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500
              ${selected.length >= minSelect ? 'bg-[#0f0f0f]' : 'bg-gray-300'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* 카테고리별 태그 */}
      {Object.entries(grouped).map(([cat, catTags]) => {
        const meta = CATEGORY_META[cat] ?? { emoji: '•', label: cat };
        return (
          <div key={cat}>
            {/* 카테고리 헤더 */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">{meta.emoji}</span>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {meta.label}
              </span>
            </div>

            {/* 태그 칩 목록 */}
            <div className="flex flex-wrap gap-2">
              {catTags.map((tag) => {
                const isSelected = selected.includes(tag.id);
                const isDisabled = !isSelected && selected.length >= maxSelect;
                return (
                  <button
                    key={tag.id}
                    onClick={() => !isDisabled && toggle(tag.id)}
                    disabled={isDisabled}
                    className={`text-sm px-4 py-2 rounded-full border-[1.5px] transition-all duration-200
                      active:scale-95
                      ${isSelected
                        ? 'bg-[#0f0f0f] text-white border-[#0f0f0f] shadow-sm'
                        : isDisabled
                          ? 'bg-white text-gray-200 border-gray-100 cursor-not-allowed'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 선택 부족 경고 */}
      {isUnder && (
        <p className="text-xs text-center text-gray-300 mt-2">
          {minSelect - selected.length}개 더 선택하면 매칭이 시작돼요
        </p>
      )}
    </div>
  );
}
