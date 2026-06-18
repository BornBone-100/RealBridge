'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getClient } from '@/lib/supabase';

const DATE_THEMES = [
  { emoji: '☕', title: '가볍게 차나 식사' },
  { emoji: '💃', title: '여자가 원하는 데이트' },
  { emoji: '🎯', title: '남자가 원하는 데이트' },
];

// ── 3차 전용: 최종 결정 결과 화면 ────────────────────────
function FinalResultScreen({
  myChoice,
  partnerResponded,
  matchSuccess,
  onConfirm,
}: {
  myChoice: boolean;
  partnerResponded: boolean;
  matchSuccess: boolean | null; // null = 상대 미응답
  onConfirm: () => void;
}) {
  if (!partnerResponded) {
    // 상대방 아직 미응답
    return (
      <div className="flex flex-col min-h-screen bg-white items-center justify-center px-8 text-center gap-6">
        <div className="text-6xl animate-pulse">💌</div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {myChoice ? '소중한 마음을 전했어요' : '답변해 주셨습니다'}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            상대방의 응답을 기다리고 있어요.<br />
            결과가 나오면 알림으로 알려드릴게요 💕
          </p>
        </div>
        <div className="bg-gray-50 rounded-2xl px-5 py-4 w-full">
          <p className="text-xs text-gray-400 leading-relaxed">
            💡 양쪽 모두 응답 완료 후 결과가 확정됩니다.<br />
            결과는 상대방에게 공개되지 않습니다.
          </p>
        </div>
        <button onClick={onConfirm}
          className="bg-[#0f0f0f] text-white px-8 py-3.5 rounded-full text-sm font-medium">
          확인
        </button>
      </div>
    );
  }

  if (matchSuccess) {
    // 양쪽 모두 YES → 매칭 성공! 🎉
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-rose-50 to-white
                      items-center justify-center px-8 text-center gap-6">
        <div className="text-6xl">💞</div>
        <div>
          <p className="text-xs font-medium text-rose-400 mb-2 tracking-widest uppercase">Match</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">서로 계속 만나고 싶어해요!</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            3번의 만남을 넘어<br />
            진짜 인연이 시작됩니다 🌸
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-rose-100 px-5 py-4 w-full">
          <p className="text-sm text-gray-600 leading-relaxed">
            3rd Vibe 매니저가 다음 단계를 안내해 드릴게요.<br />
            컨시어지 채팅을 확인해보세요 💌
          </p>
        </div>
        <button onClick={onConfirm}
          className="bg-rose-500 text-white px-8 py-3.5 rounded-full text-sm font-medium
                     active:scale-95 transition-all">
          매니저에게 연락하기
        </button>
      </div>
    );
  }

  // 한 명 이상 NO → 매칭 종료
  return (
    <div className="flex flex-col min-h-screen bg-white items-center justify-center px-8 text-center gap-6">
      <div className="text-6xl">🍀</div>
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">3번의 만남이 마무리됐어요</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          짧은 인연이었지만 소중한 경험이 됐기를 바라요.<br />
          더 좋은 인연을 만나실 거예요 ✨
        </p>
      </div>
      <div className="bg-gray-50 rounded-2xl px-5 py-4 w-full">
        <p className="text-sm text-gray-600 leading-relaxed">
          보증금 30,000원이 자동으로 환불 처리됩니다.<br />
          영업일 기준 3~5일 이내 입금됩니다.
        </p>
      </div>
      <button onClick={onConfirm}
        className="bg-[#0f0f0f] text-white px-8 py-3.5 rounded-full text-sm font-medium">
        확인
      </button>
    </div>
  );
}

// ── 3차 전용: 최종 결정 화면 ──────────────────────────────
function FinalDecisionScreen({
  rating,
  setRating,
  decision,
  setDecision,
  comment,
  setComment,
  loading,
  onSubmit,
}: {
  rating: number;
  setRating: (n: number) => void;
  decision: boolean | null;
  setDecision: (v: boolean) => void;
  comment: string;
  setComment: (s: string) => void;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 3차 특별 헤더 */}
      <div className="px-6 pt-16 pb-6 text-center bg-gradient-to-b from-rose-50 to-white">
        <p className="text-3xl mb-3">🎯</p>
        <h1 className="text-xl font-bold text-gray-900 mb-1">마지막 만남</h1>
        <p className="text-sm text-gray-500">남자가 원하는 데이트 · 3차</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          {[1, 2, 3].map(n => (
            <div key={n} className={`w-2.5 h-2.5 rounded-full ${n <= 3 ? 'bg-rose-400' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 space-y-7 pb-4">
        {/* 별점 */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3 text-center">오늘 만남은 어떠셨나요?</p>
          <div className="flex gap-3 justify-center">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setRating(n)}
                className="text-4xl transition-transform active:scale-110">
                {n <= rating ? '⭐' : '☆'}
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-xs text-gray-400 mt-2">
              {['', '아쉬웠어요', '조금 아쉬웠어요', '괜찮았어요', '좋았어요', '정말 좋았어요!'][rating]}
            </p>
          )}
        </div>

        {/* 핵심: 최종 결정 */}
        <div>
          <p className="text-base font-semibold text-gray-900 mb-1 text-center">
            앞으로도 계속 만나고 싶으신가요?
          </p>
          <p className="text-xs text-gray-400 text-center mb-4">
            상대방의 응답과 함께 결과가 확정됩니다
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDecision(true)}
              className={`flex-1 py-4 rounded-2xl border-2 text-sm font-semibold transition-all
                ${decision === true
                  ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-100'
                  : 'bg-white text-gray-700 border-gray-200'}`}>
              <div className="text-xl mb-1">💕</div>
              계속 만나고 싶어요
            </button>
            <button
              onClick={() => setDecision(false)}
              className={`flex-1 py-4 rounded-2xl border-2 text-sm font-semibold transition-all
                ${decision === false
                  ? 'bg-gray-100 text-gray-600 border-gray-300'
                  : 'bg-white text-gray-700 border-gray-200'}`}>
              <div className="text-xl mb-1">🍀</div>
              여기까지 할게요
            </button>
          </div>
          <p className="text-[11px] text-gray-400 text-center mt-2">
            🔒 나의 선택은 상대방에게 공개되지 않습니다
          </p>
        </div>

        {/* 한마디 */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            한마디 남겨주세요 <span className="text-gray-400 font-normal">(선택)</span>
          </p>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="3번의 만남을 돌아보며 솔직한 소감을 남겨주세요. 관리자에게만 전달됩니다."
            rows={3}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm
                       outline-none focus:border-gray-300 resize-none"
          />
        </div>
      </div>

      {/* 제출 */}
      <div className="px-6 pb-10 pt-2">
        <button
          onClick={onSubmit}
          disabled={rating === 0 || decision === null || loading}
          className="w-full bg-[#0f0f0f] text-white py-4 rounded-2xl text-sm font-semibold
                     disabled:opacity-30 active:scale-[0.98] transition-all">
          {loading ? '제출 중...' : '최종 결정 제출하기'}
        </button>
      </div>
    </div>
  );
}

// ── 1·2차 일반 피드백 ─────────────────────────────────────
function NormalFeedbackScreen({
  milestoneNo,
  rating,
  setRating,
  wantNext,
  setWantNext,
  comment,
  setComment,
  loading,
  onSubmit,
}: {
  milestoneNo: number;
  rating: number;
  setRating: (n: number) => void;
  wantNext: boolean | null;
  setWantNext: (v: boolean) => void;
  comment: string;
  setComment: (s: string) => void;
  loading: boolean;
  onSubmit: () => void;
}) {
  const theme = DATE_THEMES[milestoneNo - 1];
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-900">{milestoneNo}차 데이트 피드백</p>
          <p className="text-xs text-gray-400">{theme.emoji} {theme.title}</p>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 space-y-8">
        <div>
          <p className="text-base font-medium text-gray-900 mb-4">오늘 만남은 어떠셨나요?</p>
          <div className="flex gap-3 justify-center">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setRating(n)} className="text-4xl active:scale-110 transition-transform">
                {n <= rating ? '⭐' : '☆'}
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-gray-400 mt-2">
              {['', '별로였어요', '조금 아쉬웠어요', '괜찮았어요', '좋았어요', '정말 좋았어요!'][rating]}
            </p>
          )}
        </div>

        <div>
          <p className="text-base font-medium text-gray-900 mb-3">다음 만남을 이어가고 싶으신가요?</p>
          <div className="flex gap-3">
            <button onClick={() => setWantNext(true)}
              className={`flex-1 py-3.5 rounded-2xl border text-sm font-medium transition-colors
                ${wantNext === true ? 'bg-[#0f0f0f] text-white border-[#0f0f0f]' : 'bg-white text-gray-700 border-gray-200'}`}>
              네, 계속 만나고 싶어요 ✅
            </button>
            <button onClick={() => setWantNext(false)}
              className={`flex-1 py-3.5 rounded-2xl border text-sm font-medium transition-colors
                ${wantNext === false ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-700 border-gray-200'}`}>
              여기까지 할게요 ❌
            </button>
          </div>
        </div>

        <div>
          <p className="text-base font-medium text-gray-900 mb-2">
            한마디 <span className="text-gray-400 font-normal text-sm">(선택)</span>
          </p>
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="솔직한 후기를 남겨주세요. 관리자에게만 전달됩니다."
            rows={4}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm
                       outline-none focus:border-gray-300 resize-none" />
          <p className="text-xs text-gray-400 mt-1.5">💡 답변 내용은 상대방에게 절대 공개되지 않습니다</p>
        </div>
      </div>

      <div className="px-6 pb-10 pt-2">
        <button onClick={onSubmit} disabled={rating === 0 || wantNext === null || loading}
          className="w-full bg-[#0f0f0f] text-white py-4 rounded-2xl text-sm font-medium
                     disabled:opacity-30 active:scale-[0.98] transition-all">
          {loading ? '제출 중...' : '피드백 제출하기'}
        </button>
      </div>
    </div>
  );
}

// ── 메인 폼 ───────────────────────────────────────────────
function FeedbackForm() {
  const router = useRouter();
  const params = useSearchParams();
  const milestoneId = params.get('mid');
  const milestoneNo = Number(params.get('no') ?? 1) as 1 | 2 | 3;

  const [screen, setScreen] = useState<'form' | 'result'>('form');
  const [rating, setRating] = useState(0);
  const [decision, setDecision] = useState<boolean | null>(null); // 3차용
  const [wantNext, setWantNext] = useState<boolean | null>(null);  // 1·2차용
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // 3차 결과
  const [partnerResponded, setPartnerResponded] = useState(false);
  const [matchSuccess, setMatchSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    getClient().auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/onboarding');
      else setUserId(data.user.id);
    });
  }, []);

  const handleSubmit = async () => {
    const myChoice = milestoneNo === 3 ? decision : wantNext;
    if (!userId || !milestoneId || rating === 0 || myChoice === null) return;
    setLoading(true);

    const supabase = getClient();
    const theme = DATE_THEMES[milestoneNo - 1];

    // 1. feedback_surveys upsert (실제 컬럼명 사용)
    await supabase
      .from('feedback_surveys')
      .upsert({
        milestone_id: milestoneId,
        user_id: userId,
        rating,
        want_next_date: myChoice,
        free_comment: comment.trim() || null,
        is_answered: true,
        answered_at: new Date().toISOString(),
        responded_at: new Date().toISOString(),
      }, { onConflict: 'milestone_id,user_id' });

    // 2. 관리자 컨시어지 메시지
    const label = milestoneNo === 3 ? '최종 결정' : '피드백';
    const choiceLabel = milestoneNo === 3
      ? (myChoice ? '계속 만나고 싶음 💕' : '여기까지 🍀')
      : (myChoice ? '다음 만남 원함 ✅' : '여기까지 ❌');

    await supabase.from('concierge_messages').insert({
      user_id: userId,
      content: [
        `[${milestoneNo}차 데이트 ${label} — ${theme.emoji} ${theme.title}]`,
        `⭐ 별점: ${rating}/5`,
        `💬 선택: ${choiceLabel}`,
        comment.trim() ? `📝 한마디: ${comment.trim()}` : null,
      ].filter(Boolean).join('\n'),
      is_from_admin: false,
      is_read: false,
    });

    // 3. 1·2차: 원치 않으면 즉시 종료
    if (milestoneNo < 3 && myChoice === false) {
      setLoading(false);
      setScreen('result');
      return;
    }

    // 4. 3차: 상대방 응답 여부 확인
    if (milestoneNo === 3) {
      const { data: surveys } = await supabase
        .from('feedback_surveys')
        .select('user_id, want_next_date, is_answered')
        .eq('milestone_id', milestoneId);

      const responded = surveys?.filter(s => s.is_answered) ?? [];
      const partnerSurvey = responded.find(s => s.user_id !== userId);

      if (partnerSurvey) {
        // 상대방도 이미 응답 완료 → 결과 확정
        const bothYes = myChoice === true && partnerSurvey.want_next_date === true;
        setMatchSuccess(bothYes);
        setPartnerResponded(true);

        // match 상태 업데이트 (3차 결과 반영)
        const { data: msData } = await supabase
          .from('date_milestones')
          .select('match_id')
          .eq('id', milestoneId)
          .single();

        if (msData?.match_id) {
          await supabase.from('matches').update({
            state: bothYes ? 'success' : 'ended',
            closed_at: bothYes ? null : new Date().toISOString(),
          }).eq('id', msData.match_id);
        }
      } else {
        setPartnerResponded(false);
        setMatchSuccess(null);
      }
    }

    setLoading(false);
    setScreen('result');
  };

  if (screen === 'result') {
    if (milestoneNo < 3) {
      // 1·2차 완료 화면
      return (
        <div className="flex flex-col min-h-screen bg-white items-center justify-center px-8 text-center gap-5">
          <div className="text-5xl">{wantNext ? '😊' : '🍀'}</div>
          <h2 className="text-xl font-semibold text-gray-900">피드백 감사합니다!</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            {wantNext
              ? '다음 만남을 기대해 보세요 💕'
              : '더 좋은 인연을 만나실 거예요.\n보증금은 자동 환불 처리됩니다.'}
          </p>
          <button onClick={() => router.push('/matches')}
            className="bg-[#0f0f0f] text-white px-8 py-3.5 rounded-full text-sm font-medium">
            확인
          </button>
        </div>
      );
    }

    // 3차 결과 화면
    return (
      <FinalResultScreen
        myChoice={decision === true}
        partnerResponded={partnerResponded}
        matchSuccess={matchSuccess}
        onConfirm={() => router.push(matchSuccess ? '/concierge' : '/matches')}
      />
    );
  }

  if (milestoneNo === 3) {
    return (
      <FinalDecisionScreen
        rating={rating} setRating={setRating}
        decision={decision} setDecision={setDecision}
        comment={comment} setComment={setComment}
        loading={loading} onSubmit={handleSubmit}
      />
    );
  }

  return (
    <NormalFeedbackScreen
      milestoneNo={milestoneNo}
      rating={rating} setRating={setRating}
      wantNext={wantNext} setWantNext={setWantNext}
      comment={comment} setComment={setComment}
      loading={loading} onSubmit={handleSubmit}
    />
  );
}

export default function DateFeedbackPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
      </div>
    }>
      <FeedbackForm />
    </Suspense>
  );
}
