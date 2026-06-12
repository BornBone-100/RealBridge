'use client';

/**
 * /profile/values — 가치관 & 라이프스타일 태그 설정 페이지
 * ==========================================================
 * 온보딩 마지막 단계 또는 프로필 편집 시 진입.
 * TagSelector + 연애관 입력 + 음성 소개 녹음 버튼.
 */

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TagSelector, { type Tag } from '@/components/matching/TagSelector';

// 실제 서비스: /api/matching/tags 엔드포인트에서 가져옴
const TAGS: Tag[] = [
  // 연락
  { id: 'c1', category: 'contact',   label: '연락은 자주 📱' },
  { id: 'c2', category: 'contact',   label: '하루 한 번이면 충분' },
  { id: 'c3', category: 'contact',   label: '바쁘면 연락 줄어도 OK' },
  // 주말
  { id: 'w1', category: 'weekend',   label: '주말엔 밖으로 🏃' },
  { id: 'w2', category: 'weekend',   label: '집에서 쉬는 게 최고' },
  { id: 'w3', category: 'weekend',   label: '반반 섞어서' },
  // 미래
  { id: 'f1', category: 'future',    label: '결혼 생각 있어요 💍' },
  { id: 'f2', category: 'future',    label: '지금은 천천히 알아가요' },
  { id: 'f3', category: 'future',    label: '장거리 OK' },
  { id: 'f4', category: 'future',    label: '언젠간 같은 나라에' },
  // 가치관
  { id: 'v1', category: 'values',    label: '솔직함이 제일 중요해요' },
  { id: 'v2', category: 'values',    label: '서로의 공간 존중' },
  { id: 'v3', category: 'values',    label: '감정 표현에 솔직해요' },
  { id: 'v4', category: 'values',    label: '다름을 즐겨요' },
  // 라이프스타일
  { id: 'l1', category: 'lifestyle', label: '아침형 인간 ☀️' },
  { id: 'l2', category: 'lifestyle', label: '저녁형 인간 🌙' },
  { id: 'l3', category: 'lifestyle', label: '여행을 자주 가요 ✈️' },
  { id: 'l4', category: 'lifestyle', label: '건강관리 열심히' },
  // 취미
  { id: 'h1', category: 'hobby',     label: '카페 투어 ☕' },
  { id: 'h2', category: 'hobby',     label: '영화/드라마 🎬' },
  { id: 'h3', category: 'hobby',     label: '음악 듣기 🎵' },
  { id: 'h4', category: 'hobby',     label: '맛집 탐방 🍜' },
  { id: 'h5', category: 'hobby',     label: '독서 📚' },
  { id: 'h6', category: 'hobby',     label: '게임 🎮' },
];

export default function ValuesPage() {
  const router = useRouter();

  const [selectedTags, setSelectedTags]   = useState<string[]>([]);
  const [datingValues, setDatingValues]   = useState('');
  const [isRecording, setIsRecording]     = useState(false);
  const [recordedBlob, setRecordedBlob]   = useState<Blob | null>(null);
  const [recordDuration, setRecordDuration] = useState(0);

  const mediaRef     = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const timerRef     = useRef<NodeJS.Timeout | null>(null);

  const canSave =
    selectedTags.length >= 3 &&
    datingValues.length >= 50;

  // ── 음성 녹음 ────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/m4a' });
        setRecordedBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRef.current = recorder;
      setIsRecording(true);
      setRecordDuration(0);

      timerRef.current = setInterval(() => {
        setRecordDuration((d) => {
          if (d >= 89) {
            stopRecording();
            return 90;
          }
          return d + 1;
        });
      }, 1000);
    } catch {
      alert('마이크 접근 권한이 필요합니다.');
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── 저장 ─────────────────────────────────────────────────
  const handleSave = async () => {
    // TODO: POST /api/matching/profile/:userId
    // {
    //   lifestyle_tag_ids: selectedTags,
    //   dating_values: datingValues,
    //   voice_intro_url: (S3 업로드 후 URL),
    //   voice_duration_s: recordDuration,
    // }
    router.push('/home');
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 상단 */}
      <div className="flex items-center gap-4 px-6 pt-14 pb-4">
        <button onClick={() => router.back()}>
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-lg font-medium text-gray-900">가치관 & 라이프스타일</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-32">

        {/* 소개 */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 leading-relaxed">
            나와 잘 맞는 사람을 찾는 데 가장 중요한 정보예요.<br />
            솔직하게 선택할수록 좋은 매칭이 이루어져요.
          </p>
        </div>

        {/* TagSelector */}
        <div className="mb-8">
          <TagSelector
            tags={TAGS}
            selected={selectedTags}
            onChange={setSelectedTags}
            minSelect={3}
            maxSelect={10}
          />
        </div>

        {/* 연애관 텍스트 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">나의 연애관</p>
            <span className={`text-xs ${datingValues.length >= 50 ? 'text-green-500' : 'text-gray-300'}`}>
              {datingValues.length}/50+
            </span>
          </div>
          <textarea
            value={datingValues}
            onChange={(e) => setDatingValues(e.target.value)}
            placeholder="장거리 연애에 대한 생각, 이상적인 관계의 모습, 상대에게 기대하는 것 등을 자유롭게 써주세요"
            rows={5}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5
                       text-sm text-gray-700 placeholder-gray-300 outline-none
                       focus:border-gray-300 transition-colors resize-none leading-relaxed"
          />
          <div className="w-full h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${datingValues.length >= 50 ? 'bg-green-400' : 'bg-gray-300'}`}
              style={{ width: `${Math.min((datingValues.length / 50) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* 음성 소개 */}
        <div className="mb-8">
          <p className="text-sm font-medium text-gray-700 mb-1">음성 소개 <span className="text-gray-400 font-normal">(선택, 최대 90초)</span></p>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            목소리로 자신을 소개해보세요. 텍스트보다 훨씬 매력적으로 전달돼요 🎙️
          </p>

          <div className="bg-gray-50 rounded-2xl px-4 py-4">
            {!recordedBlob ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
                               transition-all active:scale-95
                    ${isRecording
                      ? 'bg-red-500 shadow-lg shadow-red-200 animate-pulse'
                      : 'bg-[#0f0f0f]'}`}
                >
                  {isRecording ? (
                    <div className="w-4 h-4 rounded-sm bg-white" />
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
                <div className="flex-1">
                  {isRecording ? (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-red-500 font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                          녹음 중
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          {formatTime(recordDuration)} / 01:30
                        </span>
                      </div>
                      <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full transition-all duration-1000"
                          style={{ width: `${(recordDuration / 90) * 100}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">버튼을 눌러 녹음 시작</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 font-medium">녹음 완료</p>
                  <p className="text-xs text-gray-400">{formatTime(recordDuration)} · 저장 시 업로드됩니다</p>
                </div>
                <button
                  onClick={() => { setRecordedBlob(null); setRecordDuration(0); }}
                  className="text-xs text-gray-400 underline"
                >
                  다시 녹음
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단 저장 버튼 */}
      <div className="fixed bottom-0 left-0 right-0">
        <div className="mx-auto max-w-sm px-5 pb-10 pt-3 bg-white border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                       disabled:opacity-30 active:scale-[0.98] transition-all"
          >
            {canSave ? '저장하고 매칭 시작' : `태그 ${Math.max(0, 3 - selectedTags.length)}개 더 + 연애관 작성 필요`}
          </button>
        </div>
      </div>
    </div>
  );
}
