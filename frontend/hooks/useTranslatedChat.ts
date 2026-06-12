/**
 * useTranslatedChat — WebSocket 실시간 번역 채팅 훅
 * ==================================================
 * - 자동 재연결 (exponential backoff)
 * - 낙관적 업데이트 (전송 즉시 UI 반영 → 서버 확인 후 확정)
 * - 타이핑 인디케이터 디바운스
 * - 언마운트 시 WebSocket 정상 종료
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ── 타입 ──────────────────────────────────────────────────────
export interface TranslatedMessage {
  id:             string;      // message_id (서버) 또는 temp_id (낙관적)
  senderId:       string;
  original:       string;
  originalLang:   string;
  translated:     string | null;
  translatedLang: string | null;
  isMe:           boolean;
  timestamp:      string;
  isPending:      boolean;     // 서버 확인 대기 중
  slangWarning:   string | null;
  type:           'message' | 'system';
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
  nationality: 'KR' | 'JP' | 'TW';
  wsBaseUrl?:  string;
}

// ── 유틸 ──────────────────────────────────────────────────────
function generateTempId(): string {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const RECONNECT_BASE_MS  = 1000;
const RECONNECT_MAX_MS   = 30_000;
const TYPING_DEBOUNCE_MS = 1500;


export function useTranslatedChat({
  roomId,
  userId,
  nationality,
  wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
}: UseChatOptions) {
  const [messages,  setMessages]  = useState<TranslatedMessage[]>([]);
  const [status,    setStatus]    = useState<ChatStatus>({
    connected: false, otherTyping: false, otherOnline: false, error: null,
  });

  const wsRef           = useRef<WebSocket | null>(null);
  const reconnectTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCount  = useRef(0);
  const typingTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted       = useRef(true);

  // ── WebSocket 연결 ────────────────────────────────────────
  const connect = useCallback(() => {
    if (!isMounted.current) return;

    const url = `${wsBaseUrl}/ws/chat/${roomId}?user_id=${encodeURIComponent(userId)}&nationality=${nationality}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMounted.current) return;
      reconnectCount.current = 0;
      setStatus((s) => ({ ...s, connected: true, error: null }));
    };

    ws.onmessage = (event) => {
      if (!isMounted.current) return;
      try {
        const data = JSON.parse(event.data as string);
        handleServerMessage(data);
      } catch {
        // JSON 파싱 실패 무시
      }
    };

    ws.onerror = () => {
      setStatus((s) => ({ ...s, error: '연결에 문제가 발생했습니다.' }));
    };

    ws.onclose = () => {
      if (!isMounted.current) return;
      setStatus((s) => ({ ...s, connected: false, otherTyping: false }));
      scheduleReconnect();
    };
  }, [roomId, userId, nationality, wsBaseUrl]);

  const scheduleReconnect = useCallback(() => {
    if (!isMounted.current) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** reconnectCount.current,
      RECONNECT_MAX_MS,
    );
    reconnectCount.current += 1;
    reconnectTimer.current = setTimeout(connect, delay);
  }, [connect]);

  // ── 서버 메시지 처리 ─────────────────────────────────────
  const handleServerMessage = (data: Record<string, unknown>) => {
    const type = data.type as string;

    if (type === 'pong') {
      setStatus((s) => ({ ...s, connected: true }));
      return;
    }

    if (type === 'typing') {
      setStatus((s) => ({ ...s, otherTyping: true }));
      setTimeout(() => setStatus((s) => ({ ...s, otherTyping: false })), 3000);
      return;
    }

    if (type === 'system') {
      const sysMsg: TranslatedMessage = {
        id:             `sys_${Date.now()}`,
        senderId:       'system',
        original:       (data.original as string) ?? '',
        originalLang:   '',
        translated:     null,
        translatedLang: null,
        isMe:           false,
        timestamp:      new Date().toISOString(),
        isPending:      false,
        slangWarning:   null,
        type:           'system',
      };
      setMessages((prev) => [...prev, sysMsg]);
      return;
    }

    if (type === 'message') {
      const incoming: TranslatedMessage = {
        id:             (data.message_id as string) ?? generateTempId(),
        senderId:       (data.sender_id as string) ?? '',
        original:       (data.original as string) ?? '',
        originalLang:   (data.original_lang as string) ?? '',
        translated:     (data.translated as string | null) ?? null,
        translatedLang: (data.translated_lang as string | null) ?? null,
        isMe:           !!(data.is_mine),
        timestamp:      (data.timestamp as string) ?? new Date().toISOString(),
        isPending:      false,
        slangWarning:   (data.slang_warning as string | null) ?? null,
        type:           'message',
      };

      setMessages((prev) => {
        // 낙관적 메시지(temp_id)를 서버 확정 메시지로 교체
        const tempId = data.temp_id as string | undefined;
        if (tempId && incoming.isMe) {
          return prev.map((m) => (m.id === tempId ? { ...incoming, isPending: false } : m));
        }
        // 중복 방지
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });

      setStatus((s) => ({ ...s, otherTyping: false }));
    }
  };

  // ── 메시지 전송 ───────────────────────────────────────────
  const sendMessage = useCallback((text: string): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !text.trim()) return false;

    const tempId = generateTempId();

    // 낙관적 업데이트
    const optimistic: TranslatedMessage = {
      id:             tempId,
      senderId:       userId,
      original:       text,
      originalLang:   { KR: 'KO', JP: 'JA', TW: 'ZH' }[nationality] ?? 'KO',
      translated:     null,
      translatedLang: null,
      isMe:           true,
      timestamp:      new Date().toISOString(),
      isPending:      true,
      slangWarning:   null,
      type:           'message',
    };
    setMessages((prev) => [...prev, optimistic]);

    ws.send(JSON.stringify({ type: 'message', text, temp_id: tempId }));
    return true;
  }, [userId, nationality]);

  // ── 타이핑 인디케이터 전송 (디바운스) ────────────────────
  const sendTyping = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (typingTimer.current) return;  // 이미 전송됨
    ws.send(JSON.stringify({ type: 'typing' }));
    typingTimer.current = setTimeout(() => {
      typingTimer.current = null;
    }, TYPING_DEBOUNCE_MS);
  }, []);

  // ── 마운트/언마운트 ───────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    connect();
    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      wsRef.current?.close(1000, 'component unmounted');
    };
  }, [connect]);

  return { messages, status, sendMessage, sendTyping };
}
