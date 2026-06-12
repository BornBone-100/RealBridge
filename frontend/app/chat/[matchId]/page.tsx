'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedView from '@/components/ProtectedView';
import { useTranslatedChat, type TranslatedMessage } from '@/hooks/useTranslatedChat';
import SafetyMenu from '@/components/SafetyMenu';

const CURRENT_USER_ID  = 'user_abc123';
const MY_NATIONALITY   = 'KR' as const;

// ── 외부 앱 감지 (프론트 이중 방어) ──────────────────────────
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

// ── 매치 정보 ────────────────────────────────────────────────
const MATCH_INFO: Record<string, {
  name: string; age: number; flag: string; nationality: 'KR' | 'JP' | 'TW';
  city: string; isTruenote: boolean; gradientFrom: string; gradientTo: string;
}> = {
  match_001: { name: 'Yuki',  age: 26, flag: '🇯🇵', nationality: 'JP', city: '도쿄',   isTruenote: true,  gradientFrom: '#ede9fe', gradientTo: '#dbeafe' },
  match_002: { name: '小雅',  age: 24, flag: '🇹🇼', nationality: 'TW', city: '타이베이', isTruenote: true,  gradientFrom: '#fef3c7', gradientTo: '#fde8d5' },
  match_003: { name: 'Haruto', age: 29, flag: '🇯🇵', nationality: 'JP', city: '오사카', isTruenote: false, gradientFrom: '#d1fae5', gradientTo: '#cffafe' },
};

// ── 대화 주제 (매칭 시 선택한 주제) ─────────────────────────
const SELECTED_TOPIC = '여행 중에 가장 기억에 남는 식당이나 카페가 있나요?';

// ── 아이스브레이커 칩 ────────────────────────────────────────
const ICEBREAKERS: Record<'JP' | 'TW', { emoji: string; text: string }[]> = {
  JP: [
    { emoji: '🍜', text: '도쿄 현지인 맛집을 알려줄 수 있어요?' },
    { emoji: '🌸', text: '일본에서 벚꽃 명소는 어디예요?' },
    { emoji: '🎮', text: '일본에서 요즘 인기 있는 게임은 뭐예요?' },
    { emoji: '🚆', text: '신칸센을 처음 타면 꼭 먹어야 할 에키벤이 있나요?' },
    { emoji: '🏯', text: '교토랑 도쿄 중에 어디를 더 좋아해요?' },
  ],
  TW: [
    { emoji: '🧋', text: '대만 버블티 원조 가게가 궁금해요!' },
    { emoji: '🌙', text: '야시장에서 꼭 먹어야 할 메뉴 추천해 주세요!' },
    { emoji: '🏖️', text: '대만에서 가장 좋아하는 여행지는 어디예요?' },
    { emoji: '🥟', text: '딘타이펑 말고 대만 현지인이 자주 가는 식당은요?' },
    { emoji: '🎉', text: '대만의 독특한 명절 문화가 궁금해요' },
  ],
};

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

        {/* ── 원문 말풍선 ── */}
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

        {/* ── 번역 말풍선 (수신 메시지만) ── */}
        {!isMe && msg.translated && (
          <>
            {showTranslation ? (
              <div className="bg-white border border-gray-100 px-4 py-2.5 rounded-2xl rounded-tl-sm
                              max-w-full shadow-sm">
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

                {/* 은어 경고 */}
                {msg.slangWarning && (
                  <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-amber-100">
                    <span className="text-amber-400 text-[10px] mt-0.5">⚠️</span>
                    <p className="text-[10px] text-amber-500 leading-relaxed">{msg.slangWarning}</p>
                  </div>
                )}
              </div>
            ) : null}

            {/* 번역 토글 버튼 */}
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

      {/* 시간 */}
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
      {/* dev */}
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
  const match   = MATCH_INFO[matchId] ?? MATCH_INFO['match_001'];

  const [topicSelected,    setTopicSelected]    = useState(matchId === 'match_001');
  const [inputText,        setInputText]         = useState('');
  const [translationOpen,  setTranslationOpen]   = useState<Record<string, boolean>>({});
  const [icebreakersOpen,  setIcebreakersOpen]   = useState(true);
  const [warningCount,     setWarningCount]       = useState(0);
  const [warningModal,     setWarningModal]       = useState<{ app: string } | null>(null);
  const [deletedModal,     setDeletedModal]       = useState(false);
  const [deletedCountdown, setDeletedCountdown]  = useState(3);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  // WebSocket 훅
  const { messages, status, sendMessage, sendTyping } = useTranslatedChat({
    roomId:      matchId,
    userId:      CURRENT_USER_ID,
    nationality: MY_NATIONALITY,
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

    // 외부 앱 감지
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

  // 아이스브레이커 칩 선택
  const handleIcebreaker = (text: string) => {
    setInputText(text);
    setIcebreakersOpen(false);
    inputRef.current?.focus();
  };

  const icebreakers = ICEBREAKERS[match.nationality as 'JP' | 'TW'] ?? [];

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
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl"
            style={{ background: `linear-gradient(135deg, ${match.gradientFrom}, ${match.gradientTo})` }}>
            {match.flag}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{match.name}, {match.age}</p>
            <p className="text-xs text-gray-400">{match.city}</p>
          </div>
        </div>
        <ChatLocked matchId={matchId} matchName={match.name} onUnlock={() => setTopicSelected(true)} />
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
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl"
            style={{ background: `linear-gradient(135deg, ${match.gradientFrom}, ${match.gradientTo})` }}>
            {match.flag}
          </div>
          {/* 온라인 표시 */}
          {status.connected && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-gray-900">{match.name}, {match.age}</p>
            {match.isTruenote && (
              <span className="bg-[#0f0f0f] text-white text-[8px] px-1.5 py-0.5 rounded-full">✓</span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {status.connected ? '온라인' : '연결 중…'}
          </p>
        </div>
        <SafetyMenu
          targetUserId={match.name}
          targetName={match.name}
          matchId={matchId}
          onBlockSuccess={() => router.replace('/matches')}
        />
      </div>

      {/* 대화 주제 배너 */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <span className="text-base flex-shrink-0">☕</span>
        <p className="text-xs text-gray-600 leading-snug line-clamp-1 flex-1">{SELECTED_TOPIC}</p>
      </div>

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
      <ProtectedView userId={CURRENT_USER_ID} className="flex-1 overflow-hidden" watermarkOpacity={0.09}>
        <div className="h-full overflow-y-auto px-4 py-4 flex flex-col gap-3">

          {/* 채팅 규칙 안내 */}
          <div className="flex justify-center">
            <div className="bg-gray-50 rounded-2xl px-4 py-3 max-w-[85%]">
              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                🌏 메시지는 자동으로 상대방 언어로 번역됩니다<br />
                🔒 외부 SNS·연락처 공유 시 계정이 삭제됩니다
              </p>
            </div>
          </div>

          {/* 메시지 목록 */}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              showTranslation={translationOpen[msg.id] ?? true}
              onToggleTranslation={() => toggleTranslation(msg.id)}
            />
          ))}

          {/* 타이핑 인디케이터 */}
          {status.otherTyping && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      </ProtectedView>

      {/* ── 아이스브레이커 칩 ─────────────────────────────────── */}
      {icebreakers.length > 0 && icebreakersOpen && messages.filter((m) => m.type === 'message').length < 3 && (
        <div className="px-4 pb-2 pt-1 border-t border-gray-50">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] text-gray-300">💬</span>
            <p className="text-[10px] text-gray-300 uppercase tracking-wide">대화 시작 질문</p>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {icebreakers.map((chip) => (
              <button
                key={chip.text}
                onClick={() => handleIcebreaker(chip.text)}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs text-gray-600
                           bg-gray-50 border border-gray-100 rounded-full px-3.5 py-2
                           active:bg-gray-100 transition-colors whitespace-nowrap"
              >
                <span>{chip.emoji}</span>
                <span>{chip.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
              placeholder={`${match.name}에게 메시지 보내기…`}
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-300 outline-none"
            />
            {/* 번역 언어 표시 */}
            <span className="text-[10px] text-gray-300 flex-shrink-0">
              {match.nationality === 'JP' ? '→ 日本語' : match.nationality === 'TW' ? '→ 中文' : '→ 한국어'}
            </span>
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
