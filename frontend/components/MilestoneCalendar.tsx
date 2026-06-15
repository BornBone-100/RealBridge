'use client';

import { useState } from 'react';

// ── 타입 ──────────────────────────────────────────────────
export type MilestoneStatus =
  | 'pending'
  | 'proposed'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export interface Milestone {
  id: string;
  milestone_no: 1 | 2 | 3;
  status: MilestoneStatus;
  proposed_datetime?: string;
  proposed_location?: string;
  confirmed_datetime?: string;
  confirmed_location?: string;
  confirmed_by_a: boolean;
  confirmed_by_b: boolean;
  completed_by_a: boolean;
  completed_by_b: boolean;
}

interface Props {
  matchId: string;
  milestones: Milestone[];
  currentUserId: string;
  isUserA: boolean;
  onPropose: (milestoneNo: number, datetime: string, location: string) => Promise<void>;
  onConfirm: (milestoneId: string) => Promise<void>;
  onComplete: (milestoneId: string) => Promise<void>;
}

const MILESTONE_LABELS = ['1차 만남', '2차 만남', '3차 만남'];

const STATUS_CONFIG: Record<MilestoneStatus, { label: string; color: string; bg: string; dot: string }> = {
  pending:   { label: '일정 미정',   color: 'text-gray-400',  bg: 'bg-gray-50',   dot: 'bg-gray-300'  },
  proposed:  { label: '날짜 제안 중', color: 'text-amber-600', bg: 'bg-amber-50',  dot: 'bg-amber-400' },
  confirmed: { label: '확정됨 ✓',    color: 'text-blue-600',  bg: 'bg-blue-50',   dot: 'bg-blue-400'  },
  completed: { label: '만남 완료 🎉', color: 'text-green-600', bg: 'bg-green-50',  dot: 'bg-green-400' },
  cancelled: { label: '취소됨',       color: 'text-red-400',   bg: 'bg-red-50',    dot: 'bg-red-300'   },
};

// ── 날짜 포맷 ─────────────────────────────────────────────
function fmtDatetime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    month: 'long', day: 'numeric',
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ── 개별 마일스톤 카드 ────────────────────────────────────
function MilestoneCard({
  ms, isUserA, onPropose, onConfirm, onComplete,
}: {
  ms: Milestone;
  isUserA: boolean;
  onPropose: (no: number, dt: string, loc: string) => Promise<void>;
  onConfirm: (id: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [propDatetime, setPropDatetime] = useState('');
  const [propLocation, setPropLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const cfg = STATUS_CONFIG[ms.status];
  const myConfirmed  = isUserA ? ms.confirmed_by_a  : ms.confirmed_by_b;
  const myCompleted  = isUserA ? ms.completed_by_a  : ms.completed_by_b;

  const handlePropose = async () => {
    if (!propDatetime || !propLocation.trim()) return;
    setLoading(true);
    await onPropose(ms.milestone_no, propDatetime, propLocation);
    setLoading(false);
    setShowForm(false);
  };

  return (
    <div className={`rounded-2xl border ${cfg.bg} p-4 mb-2`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full bg-[#0f0f0f] text-white text-xs
                          flex items-center justify-center font-semibold`}>
            {ms.milestone_no}
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {MILESTONE_LABELS[ms.milestone_no - 1]}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>

      {/* 내용 */}
      {ms.status === 'pending' && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full border border-dashed border-gray-200 rounded-xl py-3
                         text-xs text-gray-400 active:bg-gray-50 transition-colors">
              + 날짜 & 장소 제안하기
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="datetime-local"
                value={propDatetime}
                onChange={e => setPropDatetime(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5
                           text-sm outline-none focus:border-gray-400"
              />
              <input
                type="text"
                value={propLocation}
                onChange={e => setPropLocation(e.target.value)}
                placeholder="장소 입력 (예: 광안리 카페, 서면 맛집)"
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5
                           text-sm outline-none focus:border-gray-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={handlePropose}
                  disabled={!propDatetime || !propLocation || loading}
                  className="flex-1 bg-[#0f0f0f] text-white rounded-xl py-2.5 text-xs
                             font-medium disabled:opacity-40">
                  {loading ? '전송 중...' : '제안 전송'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 rounded-xl border border-gray-200 text-xs text-gray-500">
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {ms.status === 'proposed' && (
        <div className="space-y-2">
          <div className="bg-white rounded-xl px-3 py-2.5">
            <p className="text-xs text-gray-400 mb-0.5">제안된 일정</p>
            <p className="text-sm font-medium text-gray-900">
              {fmtDatetime(ms.proposed_datetime)}
            </p>
            {ms.proposed_location && (
              <p className="text-xs text-gray-500 mt-0.5">📍 {ms.proposed_location}</p>
            )}
          </div>
          {!myConfirmed ? (
            <button
              onClick={async () => { setLoading(true); await onConfirm(ms.id); setLoading(false); }}
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-xs
                         font-medium disabled:opacity-40 active:scale-[0.98] transition-all">
              {loading ? '확정 중...' : '✓ 이 일정으로 확정하기'}
            </button>
          ) : (
            <div className="bg-blue-50 rounded-xl py-2.5 text-center">
              <p className="text-xs text-blue-600">내가 확정했습니다 — 상대방 확인 대기 중...</p>
            </div>
          )}
        </div>
      )}

      {ms.status === 'confirmed' && (
        <div className="space-y-2">
          <div className="bg-white rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-medium text-blue-600">🔒 확정된 일정</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {fmtDatetime(ms.confirmed_datetime)}
            </p>
            {ms.confirmed_location && (
              <p className="text-xs text-gray-500 mt-0.5">📍 {ms.confirmed_location}</p>
            )}
          </div>

          {/* 만남 완료 확인 */}
          {!myCompleted ? (
            <button
              onClick={async () => { setLoading(true); await onComplete(ms.id); setLoading(false); }}
              disabled={loading}
              className="w-full bg-green-600 text-white rounded-xl py-2.5 text-xs
                         font-medium disabled:opacity-40 active:scale-[0.98] transition-all">
              {loading ? '확인 중...' : '만남 완료 확인하기'}
            </button>
          ) : (
            <div className="bg-green-50 rounded-xl py-2.5 text-center">
              <p className="text-xs text-green-600">완료 확인함 — 상대방 확인 대기 중...</p>
            </div>
          )}
        </div>
      )}

      {ms.status === 'completed' && (
        <div className="bg-white rounded-xl px-3 py-2.5 text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-xs text-green-600 font-medium">만남 완료!</p>
          <p className="text-xs text-gray-400 mt-0.5">{fmtDatetime(ms.confirmed_datetime)}</p>
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function MilestoneCalendar({
  matchId, milestones, currentUserId, isUserA,
  onPropose, onConfirm, onComplete,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  // 3개 슬롯 채우기
  const slots: Milestone[] = [1, 2, 3].map(no => {
    return milestones.find(m => m.milestone_no === no) ?? {
      id: `placeholder-${no}`,
      milestone_no: no as 1 | 2 | 3,
      status: 'pending' as MilestoneStatus,
      confirmed_by_a: false,
      confirmed_by_b: false,
      completed_by_a: false,
      completed_by_b: false,
    };
  });

  const completedCount = slots.filter(m => m.status === 'completed').length;

  return (
    <div className="border-b border-gray-100">
      {/* 헤더 토글 */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">📅 3회 만남 일정</span>
          <div className="flex gap-1">
            {slots.map((ms, i) => (
              <div key={i}
                className={`w-2 h-2 rounded-full ${
                  ms.status === 'completed' ? 'bg-green-400' :
                  ms.status === 'confirmed' ? 'bg-blue-400' :
                  ms.status === 'proposed'  ? 'bg-amber-400' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{completedCount}/3 완료</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* 마일스톤 카드들 */}
      {expanded && (
        <div className="px-4 pb-4">
          {slots.map(ms => (
            <MilestoneCard
              key={ms.id}
              ms={ms}
              isUserA={isUserA}
              onPropose={onPropose}
              onConfirm={onConfirm}
              onComplete={onComplete}
            />
          ))}

          {/* 보증금 안내 */}
          <div className="bg-gray-50 rounded-xl px-3 py-2.5 mt-1">
            <p className="text-xs text-gray-400 leading-relaxed">
              💡 3회 만남 모두 완료 시 서비스가 성공적으로 종료됩니다.<br />
              만남이 중단될 경우 보증금 30,000원이 자동 환불됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
