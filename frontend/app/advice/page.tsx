'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getClient } from '@/lib/supabase';

interface Message {
  id: string;
  content: string;
  isFromAdmin: boolean;
  createdAt: Date;
  isPending?: boolean;
}

const QUICK_TOPICS = [
  '첫 만남 전 긴장돼요',
  '데이트 장소 추천',
  '대화가 어색해요',
  '고백 타이밍이 궁금해요',
  '장거리 연애 고민',
  '관심 있는지 모르겠어요',
];

const WELCOME_MSG: Message = {
  id: 'welcome',
  content: '안녕하세요! 3rd Vibe 연애 고민상담 채널입니다 💕\n\n소개팅 준비부터 데이트 고민까지, 편하게 이야기 나눠요.\n매니저가 직접 답변드립니다 (평일 10:00~18:00)',
  isFromAdmin: true,
  createdAt: new Date(),
};

// advice 채널 전용 concierge_messages: content에 "[연애상담] " 프리픽스 사용
const ADVICE_PREFIX = '[연애상담] ';

export default function AdvicePage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof getClient>['channel']> | null>(null);

  useEffect(() => {
    const supabase = getClient();

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/onboarding'); return; }
      setUserId(user.id);

      // 기존 연애상담 메시지 로드 (advice 프리픽스 필터)
      const { data } = await supabase
        .from('concierge_messages')
        .select('id, content, is_from_admin, created_at')
        .eq('user_id', user.id)
        .like('content', `${ADVICE_PREFIX}%`)
        .order('created_at', { ascending: true })
        .limit(100);

      if (data && data.length > 0) {
        const loaded: Message[] = data.map(row => ({
          id: row.id,
          content: row.content.replace(ADVICE_PREFIX, ''),
          isFromAdmin: row.is_from_admin,
          createdAt: new Date(row.created_at),
        }));
        setMessages([WELCOME_MSG, ...loaded]);
      }

      // Realtime 구독
      const channel = supabase
        .channel(`advice_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'concierge_messages',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          const row = payload.new as {
            id: string; content: string; is_from_admin: boolean; created_at: string;
          };
          if (!row.is_from_admin) return;
          if (!row.content.startsWith(ADVICE_PREFIX)) return;
          setMessages(prev => {
            if (prev.some(m => m.id === row.id)) return prev;
            return [...prev, {
              id: row.id,
              content: row.content.replace(ADVICE_PREFIX, ''),
              isFromAdmin: true,
              createdAt: new Date(row.created_at),
            }];
          });
        })
        .subscribe();

      channelRef.current = channel;
    };

    init();
    return () => {
      if (channelRef.current) getClient().removeChannel(channelRef.current);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    const tempId = `tmp_${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId, content, isFromAdmin: false, createdAt: new Date(), isPending: true,
    }]);
    setInput('');
    setSending(true);

    try {
      const supabase = getClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인 필요');

      const { data, error } = await supabase
        .from('concierge_messages')
        .insert({
          user_id: user.id,
          content: `${ADVICE_PREFIX}${content}`,
          is_from_admin: false,
          is_read: false,
        })
        .select('id')
        .single();

      if (error) throw error;
      setMessages(prev =>
        prev.map(m => m.id === tempId ? { ...m, id: data.id, isPending: false } : m)
      );
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const showQuickTopics = messages.filter(m => !m.isFromAdmin).length === 0;

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
          <div className="w-9 h-9 rounded-full bg-rose-500 flex items-center justify-center text-white text-sm">
            💕
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">연애 고민상담</p>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-xs text-gray-400">3rd Vibe 매니저 · 평일 10~18시</span>
            </div>
          </div>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.isFromAdmin ? 'justify-start' : 'justify-end'}`}>
            {msg.isFromAdmin && (
              <div className="w-7 h-7 rounded-full bg-rose-500 flex items-center justify-center
                              text-white text-xs flex-shrink-0 mr-2 mt-1">
                💕
              </div>
            )}
            <div className={`max-w-[75%] ${msg.isFromAdmin ? '' : 'items-end'} flex flex-col gap-1`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
                ${msg.isFromAdmin
                  ? 'bg-gray-100 text-gray-900 rounded-tl-sm'
                  : `rounded-tr-sm ${msg.isPending ? 'bg-gray-600' : 'bg-rose-500'} text-white`}`}>
                {msg.content}
              </div>
              <span className="text-[10px] text-gray-400 px-1">{formatTime(msg.createdAt)}</span>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-rose-500 flex items-center justify-center
                            text-white text-xs mr-2">💕</div>
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

      {/* 자주 묻는 주제 */}
      {showQuickTopics && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-400 mb-2">이런 고민 있으신가요?</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {QUICK_TOPICS.map(q => (
              <button key={q} onClick={() => sendMessage(q)}
                className="flex-shrink-0 text-xs px-3.5 py-2 bg-rose-50 border border-rose-100
                           rounded-xl text-rose-600 active:bg-rose-100 transition-colors whitespace-nowrap">
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
          placeholder="고민을 편하게 털어놓으세요..."
          rows={1}
          className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm
                     outline-none focus:border-gray-300 resize-none transition-colors
                     max-h-24 overflow-y-auto"
          style={{ minHeight: '44px' }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center
                     disabled:opacity-30 active:scale-95 transition-all flex-shrink-0"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
