'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  content: string;
  isFromAdmin: boolean;
  createdAt: Date;
}

const QUICK_REPLIES = [
  '매칭 현황이 궁금해요',
  '보증금 환불을 신청하고 싶어요',
  '상대방에 대해 문의하고 싶어요',
  '서류 인증 관련 문의',
  '앱 이용 방법을 모르겠어요',
];

const AUTO_REPLY = '안녕하세요! 3rd Vibe 매니저입니다 👋\n문의 주셔서 감사합니다. 영업 시간(평일 10:00~18:00) 내 빠르게 답변드리겠습니다.\n긴급 문의는 카카오채널 @3rdvibe로도 연락 주세요.';

export default function ConciergePage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      content: AUTO_REPLY,
      isFromAdmin: true,
      createdAt: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim();
    if (!content) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      content,
      isFromAdmin: false,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      // 실제 구현:
      // 1. Supabase concierge_messages에 저장
      // 2. 백엔드 /api/concierge/send 호출 → Solapi SMS 트리거
      await new Promise(r => setTimeout(r, 800));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 헤더 */}
      <div className="px-4 pt-14 pb-3 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-9 h-9 rounded-full bg-[#0f0f0f] flex items-center justify-center text-white text-sm">
            3V
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">3rd Vibe 매니저</p>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-xs text-gray-400">평일 10:00 ~ 18:00</span>
            </div>
          </div>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isFromAdmin ? 'justify-start' : 'justify-end'}`}>
            {msg.isFromAdmin && (
              <div className="w-7 h-7 rounded-full bg-[#0f0f0f] flex items-center justify-center
                              text-white text-xs flex-shrink-0 mr-2 mt-1">
                3V
              </div>
            )}
            <div className={`max-w-[75%] ${msg.isFromAdmin ? '' : 'items-end'} flex flex-col gap-1`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
                ${msg.isFromAdmin
                  ? 'bg-gray-100 text-gray-900 rounded-tl-sm'
                  : 'bg-[#0f0f0f] text-white rounded-tr-sm'}`}>
                {msg.content}
              </div>
              <span className="text-[10px] text-gray-400 px-1">{formatTime(msg.createdAt)}</span>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-[#0f0f0f] flex items-center justify-center
                            text-white text-xs mr-2">3V</div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 빠른 답변 버튼 */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-400 mb-2">자주 묻는 질문</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_REPLIES.map(q => (
              <button key={q} onClick={() => sendMessage(q)}
                className="text-xs px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl
                           text-gray-600 active:bg-gray-100 transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 입력창 */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요..."
          rows={1}
          className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm
                     outline-none focus:border-gray-300 resize-none transition-colors
                     max-h-24 overflow-y-auto"
          style={{ minHeight: '44px' }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-full bg-[#0f0f0f] flex items-center justify-center
                     disabled:opacity-30 active:scale-95 transition-all flex-shrink-0"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
