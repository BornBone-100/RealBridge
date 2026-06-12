'use client';

/**
 * SafetyMenu — 3점 메뉴 → 차단/신고 모달
 * ==========================================
 * 사용 위치: 채팅창 헤더, 프로필 카드 우상단
 *
 * 플로우:
 *   점 3개 버튼 tap
 *     → 바텀 시트 (차단하기 / 신고하기 / 취소)
 *       → [차단] 확인 다이얼로그
 *       → [신고] 사유 선택 폼 + 부가 설명 → 제출
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ── 타입 ──────────────────────────────────────────────────────
type Sheet = 'closed' | 'menu' | 'block_confirm' | 'report_form' | 'done';

interface ReportReason {
  code:  string;
  label: string;
}

const REPORT_REASONS: ReportReason[] = [
  { code: 'fake_profile',  label: '가짜 프로필 / 사진 도용' },
  { code: 'harassment',    label: '욕설 / 괴롭힘' },
  { code: 'spam',          label: '스팸 / 광고성 메시지' },
  { code: 'inappropriate', label: '부적절한 콘텐츠' },
  { code: 'scam',          label: '사기 / 피싱 시도' },
  { code: 'other',         label: '기타' },
];

interface SafetyMenuProps {
  targetUserId:   string;
  targetName:     string;
  matchId?:       string;
  onBlockSuccess?: () => void;   // 차단 완료 후 콜백 (채팅방 닫기 등)
}

export default function SafetyMenu({
  targetUserId,
  targetName,
  matchId,
  onBlockSuccess,
}: SafetyMenuProps) {
  const router = useRouter();

  const [sheet,        setSheet]        = useState<Sheet>('closed');
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [description,  setDescription]  = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [doneType,     setDoneType]     = useState<'block' | 'report' | null>(null);

  const close = () => {
    setSheet('closed');
    setSelectedCode('');
    setDescription('');
  };

  // ── 차단 처리 ─────────────────────────────────────────────
  const handleBlock = useCallback(async () => {
    setIsLoading(true);
    try {
      // 실제: await api.safety.block(...)
      await new Promise((r) => setTimeout(r, 700));   // mock delay
      setDoneType('block');
      setSheet('done');
      setTimeout(() => {
        close();
        onBlockSuccess?.();
      }, 1800);
    } catch {
      alert('차단 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, matchId, onBlockSuccess]);

  // ── 신고 처리 ─────────────────────────────────────────────
  const handleReport = useCallback(async () => {
    if (!selectedCode) return;
    setIsLoading(true);
    try {
      // 실제: await api.safety.report(...)
      await new Promise((r) => setTimeout(r, 800));   // mock delay
      setDoneType('report');
      setSheet('done');
      setTimeout(() => {
        close();
        onBlockSuccess?.();   // 신고도 자동 차단 → 동일 콜백
      }, 1800);
    } catch {
      alert('신고 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, matchId, selectedCode, description]);

  return (
    <>
      {/* ── 점 3개 트리거 버튼 ─────────────────────────────── */}
      <button
        onClick={() => setSheet('menu')}
        className="w-8 h-8 flex items-center justify-center rounded-full
                   active:bg-gray-100 transition-colors"
        aria-label="더 보기"
      >
        <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 5.25a.75.75 0 110-1.5.75.75 0 010 1.5zm0 7.5a.75.75 0 110-1.5.75.75 0 010 1.5zm0 7.5a.75.75 0 110-1.5.75.75 0 010 1.5z" />
        </svg>
      </button>

      {/* ── 백드롭 ───────────────────────────────────────────── */}
      {sheet !== 'closed' && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          onClick={close}
        />
      )}

      {/* ── 바텀 시트 컨테이너 ──────────────────────────────── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 flex justify-center
                    transition-transform duration-300 ease-out
          ${sheet !== 'closed' ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="w-full max-w-sm bg-white rounded-t-3xl overflow-hidden
                        shadow-2xl shadow-black/10">

          {/* ── 1. 메뉴 시트 ────────────────────────────────── */}
          {sheet === 'menu' && (
            <div className="px-5 pt-5 pb-10">
              {/* 핸들 */}
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

              {/* 상대방 정보 */}
              <p className="text-xs text-gray-400 text-center mb-4">
                {targetName}님에 대한 조치
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setSheet('report_form')}
                  className="flex items-center gap-4 w-full px-4 py-4 rounded-2xl
                             bg-gray-50 active:bg-gray-100 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3 3l1.664 9.776A2 2 0 006.64 14.4H12m6-9H6.12l-.32-1.896A1 1 0 004.82 2H3m18 18l-8-8m0 0l-8 8m8-8V3" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">신고하기</p>
                    <p className="text-xs text-gray-400 mt-0.5">부적절한 행동을 운영팀에 알려요</p>
                  </div>
                </button>

                <button
                  onClick={() => setSheet('block_confirm')}
                  className="flex items-center gap-4 w-full px-4 py-4 rounded-2xl
                             bg-gray-50 active:bg-gray-100 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">차단하기</p>
                    <p className="text-xs text-gray-400 mt-0.5">매칭을 해제하고 서로 보이지 않게 해요</p>
                  </div>
                </button>

                <button
                  onClick={close}
                  className="w-full px-4 py-3.5 text-sm text-gray-400 rounded-2xl
                             active:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* ── 2. 차단 확인 ────────────────────────────────── */}
          {sheet === 'block_confirm' && (
            <div className="px-6 pt-6 pb-10">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <h3 className="text-base font-medium text-gray-900 mb-1">
                  {targetName}님을 차단할까요?
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  차단하면 서로의 프로필과 메시지가<br />
                  모두 보이지 않게 됩니다.<br />
                  <span className="text-gray-500 font-medium">이 작업은 취소할 수 없습니다.</span>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSheet('menu')}
                  className="flex-1 py-3.5 rounded-2xl bg-gray-50 text-sm text-gray-500
                             active:bg-gray-100 transition-colors"
                >
                  돌아가기
                </button>
                <button
                  onClick={handleBlock}
                  disabled={isLoading}
                  className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white text-sm font-medium
                             disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                  {isLoading ? '처리 중…' : '차단하기'}
                </button>
              </div>
            </div>
          )}

          {/* ── 3. 신고 폼 ──────────────────────────────────── */}
          {sheet === 'report_form' && (
            <div className="px-5 pt-5 pb-10 max-h-[90vh] overflow-y-auto">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

              <h3 className="text-base font-medium text-gray-900 mb-1 text-center">
                신고 사유를 선택해 주세요
              </h3>
              <p className="text-xs text-gray-400 text-center mb-5">
                신고 내용은 운영팀에만 전달되며<br />상대방에게 알려지지 않습니다
              </p>

              {/* 사유 선택 */}
              <div className="flex flex-col gap-2 mb-4">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason.code}
                    onClick={() => setSelectedCode(reason.code)}
                    className={`flex items-center justify-between px-4 py-3.5 rounded-2xl
                                border-[1.5px] transition-all active:scale-[0.99]
                      ${selectedCode === reason.code
                        ? 'border-[#0f0f0f] bg-[#0f0f0f]'
                        : 'border-gray-100 bg-gray-50'}`}
                  >
                    <span className={`text-sm ${selectedCode === reason.code ? 'text-white' : 'text-gray-700'}`}>
                      {reason.label}
                    </span>
                    <div className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center
                      ${selectedCode === reason.code ? 'border-white' : 'border-gray-300'}`}>
                      {selectedCode === reason.code && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* 부가 설명 */}
              <div className="mb-5">
                <p className="text-xs text-gray-400 mb-1.5">추가 설명 (선택)</p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="구체적인 상황을 적어주시면 더 빠른 처리에 도움이 됩니다"
                  maxLength={500}
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3
                             text-sm text-gray-700 placeholder-gray-300 outline-none
                             focus:border-gray-300 transition-colors resize-none"
                />
                <p className="text-[10px] text-gray-300 text-right mt-1">
                  {description.length}/500
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSheet('menu')}
                  className="flex-1 py-3.5 rounded-2xl bg-gray-50 text-sm text-gray-500"
                >
                  취소
                </button>
                <button
                  onClick={handleReport}
                  disabled={!selectedCode || isLoading}
                  className="flex-1 py-3.5 rounded-2xl bg-[#0f0f0f] text-white text-sm font-medium
                             disabled:opacity-30 active:scale-[0.98] transition-all"
                >
                  {isLoading ? '처리 중…' : '신고 제출'}
                </button>
              </div>
            </div>
          )}

          {/* ── 4. 완료 화면 ────────────────────────────────── */}
          {sheet === 'done' && (
            <div className="px-6 pt-8 pb-12 flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4
                ${doneType === 'block' ? 'bg-gray-100' : 'bg-green-50'}`}>
                <svg className={`w-8 h-8 ${doneType === 'block' ? 'text-gray-500' : 'text-green-500'}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-gray-900 mb-1.5">
                {doneType === 'block' ? '차단되었습니다' : '신고가 접수되었습니다'}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {doneType === 'block'
                  ? `${targetName}님이 차단되었습니다.\n더 이상 서로의 프로필이 보이지 않습니다.`
                  : '운영팀이 검토 후 조치를 취할 예정입니다.\n신고해 주셔서 감사합니다.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
