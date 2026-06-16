'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedView from '@/components/ProtectedView';
import { useTranslatedChat, type TranslatedMessage } from '@/hooks/useTranslatedChat';
import SafetyMenu from '@/components/SafetyMenu';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getClient } from '@/lib/supabase';

// ── 외부 앱 감지 ─────────────────────────────────────────────
const EXTERNAL_PATTERNS: { app: string; regex: RegExp }[] = [
  { app: 'KakaoTalk', regex: /카카오톡?|카톡|kakao\s*talk|katalk/i },
  { app: 'LINE',      regex: /\bline\s*(id|아이디|계정)?\b|라인\s*(id|아이디|계정|으로|에서)/i },
  { app: 'WhatsApp',  regex: /whats\s*app|왓츠\s*앱/i },
  { app: 'WeChat',    regex: /위챗|wechat|微信/i },
  { app: 'Instagram', regex: /인스타(그램)?로\s*|인스타\s*(dm|디엠|아이디)/i },
  { app: 'Telegram',  regex: /텔레그램|telegram/i },
  { app: 'Phone',     regex: /\d{2,3}[-‐–\s]\d{3,4}[-‐–\s]\d{4}/ },
  { app: 'SNS Handle', regex: /@[a-zA-Z0-9_.]{3,}/ },
];

function detectExternalApp(text: string): string | null {
  for (const { app, regex } of EXTERNAL_PATTERNS) {
    if (regex.test(text)) return app;
  }
  return null;
}

// ── 파트너 정보 타입 ─────────────────────────────────────────
interface PartnerInfo {
  id: string;
  name: string;
  age: number | null;
  district: string | null;
  mbti: string | null;
  is_verified: boolean;
  gradientFrom: string;
  gradientTo: string;
  topicContent: string | null;
  photoUrl: string | null;
}

const GRADIENTS = [
  { from: '#ede9fe', to: '#dbeafe' },
  { from: '#fef3c7', to: '#fde8d5' },
  { from: '#d1fae5', to: '#cffafe' },
  { from: '#fce7f3', to: '#fef3c7' },
];

// ── 언어 라벨 ────────────────────────────────────────────────
const LANG_LABEL: Record<string, string> = {
  KO: '한국어', JA: '日本語', ZH: '中文',
};

// ── 말풍선 컴포넌트 ──────────────────────────────────────────
function MessageBubble({ msg, showTranslation, onToggleTranslation }: {
  msg: TranslatedMessage;
  showTranslation: boolean;
  onToggleTranslation: () => void;
}) {
  if (msg.type === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] text-gray-300 bg-gray-50 px-3 py-1.5 rounded-full">
          {msg.original}
        </span>
      </div>
    );
  }

  const isMe = msg.isMe;

  return (
    <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[80%] flex flex-col gap-1.5 ${isMe ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-3 rounded-3xl text-sm leading-relaxed
            ${isMe
              ? `bg-[#0f0f0f] text-white rounded-br-lg ${msg.isPending ? 'opacity-60' : ''}`
              : 'bg-gray-100 text-gray-900 rounded-bl-lg'}`}
        >
          <p>{msg.original}</p>
          {msg.isPending && (
            <span className="text-[10px] opacity-50 mt-0.5 block text-right">전송 중…</span>
          )}
        </div>

        {!isMe && msg.translated && (
          <>
            {showTranslation ? (
              <div className="bg-white border border-gray-100 px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-full shadow-sm">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                  </svg>
                  <span className="text-[10px] text-gray-300 font-medium">
                    {LANG_LABEL[msg.originalLang] ?? msg.originalLang} → {LANG_LABEL[msg.translatedLang ?? ''] ?? msg.translatedLang}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{msg.translated}</p>
                {msg.slangWarning && (
                  <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-amber-100">
                    <span className="text-amber-400 text-[10px] mt-0.5">⚠️</span>
                    <p className="text-[10px] text-amber-500 leading-relaxed">{msg.slangWarning}</p>
                  </div>
                )}
              </div>
            ) : null}
            <button
              onClick={onToggleTranslation}
              className="text-[11px] text-gray-300 flex items-center gap-1 hover:text-gray-400 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
              </svg>
              {showTranslation ? '번역 숨기기' : '번역 보기'}
            </button>
          </>
        )}
      </div>
      <span className="text-[10px] text-gray-300 px-1">
        {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

// ── 타이핑 인디케이터 ────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="bg-gray-100 rounded-3xl rounded-bl-lg px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── 채팅 잠금 화면 ───────────────────────────────────────────
function ChatLocked({ matchId, matchName, onUnlock }: {
  matchId: string; matchName: string; onUnlock: () => void;
}) {
  const router = useRouter();
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-5">
      <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center">
        <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <div>
        <p className="text-base font-medium text-gray-900 mb-1">
          대화 주제를 선택해야 채팅이 열려요
        </p>
        <p className="text-sm text-gray-400 leading-relaxed">
          {matchName}님과 첫 대화 주제를<br />함께 선택하고 대화를 시작해보세요
        </p>
      </div>
      <button
        onClick={() => router.push(`/matches/topic/${matchId}`)}
        className="bg-[#0f0f0f] text-white rounded-2xl px-6 py-3 text-sm font-medium"
      >
        주제 선택하기
      </button>
      <button onClick={onUnlock} className="text-xs text-gray-200 underline">
        개발용: 잠금 해제
      </button>
    </div>
  );
}

// ── 메인 채팅 페이지 ─────────────────────────────────────────
export default function ChatPage() {
  const router  = useRouter();
  const params  = useParams();
  const matchId = params.matchId as string;

  const { user, loading: authLoading } = useCurrentUser();
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [loadingPartner, setLoadingPartner] = useState(true);

  const [topicSelected,    setTopicSelected]    = useState(false);
  const [inputText,        setInputText]         = useState('');
  const [translationOpen,  setTranslationOpen]   = useState<Record<string, boolean>>({});
  const [icebreakersOpen,  setIcebreakersOpen]   = useState(true);
  const [warningCount,     setWarningCount]       = useState(0);
  const [warningModal,     setWarningModal]       = useState<{ app: string } | null>(null);
  const [deletedModal,     setDeletedModal]       = useState(false);
  const [deletedCountdown, setDeletedCountdown]  = useState(3);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  // 매치 정보 로딩
  useEffect(() => {
    if (authLoading || !user) return;

    const loadMatch = async () => {
      const supabase = getClient();

      // 매치 정보 조회
      const { data: matchRow } = await supabase
        .from('matches')
        .select('user_a_id, user_b_id, state')
        .eq('id', matchId)
        .single();

      if (!matchRow) { setLoadingPartner(false); return; }

      // 대화가 시작된 상태면 잠금 해제 (첫 메시지 있으면 오픈)
      const { count: msgCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', matchId);
      setTopicSelected((msgCount ?? 0) > 0 || matchRow.state === 'active');

      // 파트너 ID
      const partnerId = matchRow.user_a_id === user.id ? matchRow.user_b_id : matchRow.user_a_id;

      // 파트너 프로필
      const { data: pProfile } = await supabase
        .from('users')
        .select('id, name, birth_year, district, mbti, verification_status, profile_photo_url')
        .eq('id', partnerId)
        .single();

      // 대화 주제 (icebreaker_cards에서 랜덤 1개)
      let topicContent: string | null = null;
      const { data: card } = await supabase
        .from('icebreaker_cards')
        .select('question')
        .eq('is_active', true)
        .limit(1)
        .single();
      topicContent = card?.question ?? null;

      const age = pProfile?.birth_year
        ? new Date().getFullYear() - pProfile.birth_year
        : null;

      setPartner({
        id: partnerId,
        name: pProfile?.name ?? '상대방',
        age,
        district: pProfile?.district ?? null,
        mbti: pProfile?.mbti ?? null,
        is_verified: pProfile?.verification_status === 'approved',
        gradientFrom: GRADIENTS[0].from,
        gradientTo: GRADIENTS[0].to,
        topicContent,
        photoUrl: (pProfile as Record<string, unknown>)?.profile_photo_url as string | null ?? null,
      });

      setLoadingPartner(false);
    };

    loadMatch();
  }, [matchId, user, authLoading]);

  // WebSocket 훅
  const { messages, status, sendMessage, sendTyping } = useTranslatedChat({
    roomId:      matchId,
    userId:      user?.id ?? '',
    nationality: 'KR',
  });

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 계정 삭제 카운트다운
  useEffect(() => {
    if (!deletedModal) return;
    const interval = setInterval(() => {
      setDeletedCountdown((c) => {
        if (c <= 1) { clearInterval(interval); router.replace('/'); }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [deletedModal, router]);

  // 메시지 전송
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;

    const detected = detectExternalApp(text);
    if (detected) {
      if (warningCount >= 1) {
        setDeletedModal(true);
        return;
      }
      setWarningModal({ app: detected });
      setWarningCount((c) => c + 1);
      return;
    }

    sendMessage(text);
    setInputText('');
    setIcebreakersOpen(false);
  }, [inputText, warningCount, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleTranslation = (msgId: string) => {
    setTranslationOpen((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleIcebreaker = (text: string) => {
    setInputText(text);
    setIcebreakersOpen(false);
    inputRef.current?.focus();
  };

  // 로딩
  if (authLoading || loadingPartner) {
    return (
      <div className="flex flex-col bg-white min-h-screen items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
      </div>
    );
  }

  // 파트너 없음 (잘못된 matchId 등)
  if (!partner || !user) {
    return (
      <div className="flex flex-col bg-white min-h-screen items-center justify-center px-8 text-center gap-4">
        <p className="text-base font-medium text-gray-900">매치를 찾을 수 없어요</p>
        <button onClick={() => router.replace('/matches')}
          className="bg-[#0f0f0f] text-white rounded-2xl px-6 py-3 text-sm font-medium">
          매칭 목록으로
        </button>
      </div>
    );
  }

  // ── 잠금 화면 ──────────────────────────────────────────────
  if (!topicSelected) {
    return (
      <div className="flex flex-col bg-white min-h-screen">
        <div className="flex items-center gap-3 px-4 pt-14 pb-3 border-b border-gray-100">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center -ml-1">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          {partner.photoUrl ? (
            <img src={partner.photoUrl} alt={partner.name}
              className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-medium text-gray-700"
              style={{ background: `linear-gradient(135deg, ${partner.gradientFrom}, ${partner.gradientTo})` }}
            >
              {partner.name.slice(0, 1)}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">
              {partner.name}{partner.age ? `, ${partner.age}` : ''}
            </p>
            {partner.district && <p className="text-xs text-gray-400">부산 {partner.district}</p>}
          </div>
        </div>
        <ChatLocked matchId={matchId} matchName={partner.name} onUnlock={() => setTopicSelected(true)} />
      </div>
    );
  }

  // ── 계정 삭제 모달 ─────────────────────────────────────────
  if (deletedModal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-gray-900 mb-2">계정이 삭제되었습니다</h2>
        <p className="text-sm text-gray-400 leading-relaxed mb-4">
          외부 연락처 공유 2회 적발로<br />계정이 영구 삭제되었습니다.
        </p>
        <p className="text-sm text-red-400 font-medium">{deletedCountdown}초 후 이동합니다</p>
      </div>
    );
  }

  // ── 메인 채팅 화면 ─────────────────────────────────────────
  return (
    <div className="flex flex-col bg-white min-h-screen">

      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-3 border-b border-gray-100 bg-white">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center -ml-1">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="relative">
          {partner.photoUrl ? (
            <img src={partner.photoUrl} alt={partner.name}
              className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-medium text-gray-700"
              style={{ background: `linear-gradient(135deg, ${partner.gradientFrom}, ${partner.gradientTo})` }}
            >
              {partner.name.slice(0, 1)}
            </div>
          )}
          {status.connected && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-gray-900">
              {partner.name}{partner.age ? `, ${partner.age}` : ''}
            </p>
            {partner.is_verified && (
              <span className="bg-[#0f0f0f] text-white text-[8px] px-1.5 py-0.5 rounded-full">✓</span>
            )}
            {partner.mbti && (
              <span className="bg-gray-100 text-gray-500 text-[8px] px-1.5 py-0.5 rounded-full">
                {partner.mbti}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {status.connected ? '온라인' : '연결 중…'}
            {partner.district ? ` · 부산 ${partner.district}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {/* 관리자 문의 버튼 */}
          <button
            onClick={() => router.push('/concierge')}
            className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors"
            title="관리자 문의"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.712 4.33a9.027 9.027 0 011.652 1.306c.51.51.944 1.064 1.306 1.652M16.712 4.33l-3.448 4.138m3.448-4.138a9 9 0 00-12.77 12.77l-1.474 4.42a.75.75 0 00.956.956l4.42-1.474a9 9 0 0012.77-12.77z" />
            </svg>
          </button>
          <SafetyMenu
            targetUserId={partner.id}
            targetName={partner.name}
            matchId={matchId}
            onBlockSuccess={() => router.replace('/matches')}
          />
        </div>
      </div>

      {/* 대화 주제 배너 */}
      {partner.topicContent && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-base flex-shrink-0">☕</span>
          <p className="text-xs text-gray-600 leading-snug line-clamp-1 flex-1">{partner.topicContent}</p>
        </div>
      )}

      {/* 경고 배너 */}
      {warningCount > 0 && !warningModal && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs text-amber-700">경고 {warningCount}/2 · 다음 적발 시 계정이 즉시 삭제됩니다</p>
        </div>
      )}

      {/* 메시지 영역 */}
      <ProtectedView userId={user.id} className="flex-1 overflow-hidden" watermarkOpacity={0.09}>
        <div className="h-full overflow-y-auto px-4 py-4 flex flex-col gap-3">
          <div className="flex justify-center">
            <div className="bg-gray-50 rounded-2xl px-4 py-3 max-w-[85%]">
              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                💌 메시지는 자동으로 번역됩니다<br />
                🔒 외부 SNS·연락처 공유 시 계정이 삭제됩니다
              </p>
            </div>
          </div>

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              showTranslation={translationOpen[msg.id] ?? true}
              onToggleTranslation={() => toggleTranslation(msg.id)}
            />
          ))}

          {status.otherTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </ProtectedView>

      {/* 입력창 */}
      <div className="border-t border-gray-100 px-4 py-3 bg-white">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-gray-50 rounded-2xl px-4 py-2.5 gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                sendTyping();
              }}
              onKeyDown={handleKeyDown}
              placeholder={`${partner.name}에게 메시지 보내기…`}
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-300 outline-none"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-full bg-[#0f0f0f] flex items-center justify-center
                       disabled:opacity-30 active:scale-95 transition-all flex-shrink-0"
          >
            <svg className="w-4 h-4 text-white rotate-90" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* 경고 모달 */}
      {warningModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/20" onClick={() => setWarningModal(null)} />
          <div className="relative bg-white rounded-t-3xl w-full max-w-sm px-6 pt-6 pb-10 z-10">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-base font-medium text-gray-900 text-center mb-2">외부 앱 감지 경고</h3>
            <p className="text-sm text-gray-500 text-center leading-relaxed mb-6">
              <span className="font-medium text-gray-700">{warningModal.app}</span> 관련 내용이 감지되었습니다.<br />
              경고 1회 누적 · 1회 더 적발 시 계정이 삭제됩니다.
            </p>
            <button
              onClick={() => setWarningModal(null)}
              className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium"
            >
              확인했습니다
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
