/**
 * useTranslatedChat — Supabase Realtime 채팅 훅 (백엔드 없이 동작)
 * ================================================================
 * - 초기 메시지: Supabase chat_messages 직접 조회
 * - 실시간 업데이트: Supabase Realtime 채널
 * - 메시지 전송: Supabase insert
 * - WebSocket 백엔드가 있으면 ws:// 로도 연결 시도 (있을 때만)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getClient } from '@/lib/supabase';

// ── 타입 ──────────────────────────────────────────────────────
export interface TranslatedMessage {
  id:             string;
  senderId:       string;
  original:       string;
  originalLang:   string;
  translated:     string | null;
  translatedLang: string | null;
  isMe:           boolean;
  timestamp:      string;
  isPending:      boolean;
  slangWarning:   string | null;
  type:           'message' | 'system';
  messageType:    'text' | 'icebreaker' | 'system';
}

export interface ChatStatus {
  connected:    boolean;
  otherTyping:  boolean;
  otherOnline:  boolean;
  error:        string | null;
}

interface UseChatOptions {
  roomId:      string;
  userId:      string;
  nationality?: 'KR';
  wsBaseUrl?:  string;
}

function generateTempId(): string {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useTranslatedChat({
  roomId,
  userId,
  nationality,
}: UseChatOptions) {
  const [messages, setMessages] = useState<TranslatedMessage[]>([]);
  const [status, setStatus]     = useState<ChatStatus>({
    connected: true, otherTyping: false, otherOnline: false, error: null,
  });

  const channelRef = useRef<ReturnType<ReturnType<typeof getClient>['channel']> | null>(null);

  // ── 초기 메시지 로드 ─────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !userId) return;

    const supabase = getClient();

    const loadInitial = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, sender_id, content, created_at, is_read, message_type')
        .eq('match_id', roomId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error || !data) return;

      const mapped: TranslatedMessage[] = data.map((row) => {
        const msgType = (row.message_type ?? 'text') as 'text' | 'icebreaker' | 'system';
        return {
          id:             row.id,
          senderId:       row.sender_id,
          original:       row.content,
          originalLang:   'KO',
          translated:     null,
          translatedLang: null,
          isMe:           row.sender_id === userId,
          timestamp:      row.created_at,
          isPending:      false,
          slangWarning:   null,
          type:           msgType === 'icebreaker' ? 'system' as const : 'message' as const,
          messageType:    msgType,
        };
      });

      setMessages(mapped);
    };

    loadInitial();

    // ── Supabase Realtime 구독 ────────────────────────────────
    const channel = supabase
      .channel(`chat_${roomId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'chat_messages',
          filter: `match_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string; sender_id: string; content: string; created_at: string;
            message_type?: string;
          };
          const msgType = (row.message_type ?? 'text') as 'text' | 'icebreaker' | 'system';
          const incoming: TranslatedMessage = {
            id:             row.id,
            senderId:       row.sender_id,
            original:       row.content,
            originalLang:   'KO',
            translated:     null,
            translatedLang: null,
            isMe:           row.sender_id === userId,
            timestamp:      row.created_at,
            isPending:      false,
            slangWarning:   null,
            type:           msgType === 'icebreaker' ? 'system' : 'message',
            messageType:    msgType,
          };
          setMessages((prev) => {
            // 낙관적 메시지 교체 또는 중복 방지
            const hasTmp = prev.find(
              (m) => m.isPending && m.senderId === userId && m.original === row.content
            );
            if (hasTmp) {
              return prev.map((m) =>
                m.id === hasTmp.id ? { ...incoming } : m
              );
            }
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userId]);

  // ── 메시지 전송 ───────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!text.trim() || !userId || !roomId) return false;

    const tempId = generateTempId();

    // 낙관적 업데이트
    const optimistic: TranslatedMessage = {
      id:             tempId,
      senderId:       userId,
      original:       text,
      originalLang:   'KO',
      translated:     null,
      translatedLang: null,
      isMe:           true,
      timestamp:      new Date().toISOString(),
      isPending:      true,
      slangWarning:   null,
      type:           'message',
      messageType:    'text',
    };
    setMessages((prev) => [...prev, optimistic]);

    const supabase = getClient();
    const { error } = await supabase.from('chat_messages').insert({
      match_id:  roomId,
      sender_id: userId,
      content:   text,
      is_read:   false,
    });

    if (error) {
      // 전송 실패 시 낙관적 메시지 제거
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setStatus((s) => ({ ...s, error: '메시지 전송에 실패했습니다.' }));
      return false;
    }

    return true;
  }, [roomId, userId, nationality]);

  // typing은 no-op (백엔드 없이는 지원 안함)
  const sendTyping = useCallback(() => {}, []);

  return { messages, status, sendMessage, sendTyping };
}
