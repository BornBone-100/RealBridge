import type {
  DeviceCheckResponse,
  OtpSendRequest, OtpSendResponse,
  OtpVerifyRequest, OtpVerifyResponse,
  VerificationStartRequest, VerificationStartResponse,
  ProfileSetupRequest, ProfileSetupResponse,
  ChatSendRequest, ChatSendResponse,
  SubscriptionUpgradeRequest, SubscriptionUpgradeResponse,
  TopicSelectRequest, TopicSelectResponse,
  Match, Topic,
  ApiErrorWithStatus,
} from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

// ── 내부 fetch 헬퍼 ────────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit & { headers?: Record<string, string> } = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('rb_token') : null;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Unknown error' }));
    const error = new Error(body.detail || 'Request failed') as ApiErrorWithStatus;
    error.status = res.status;
    if (res.status === 429) {
      error.retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
    }
    throw error;
  }

  return res.json();
}

// ── API 모듈 ──────────────────────────────────────────────
export const api = {

  // ── 디바이스 체크 ──────────────────────────────────────
  device: {
    check: (fingerprint: string) =>
      request<DeviceCheckResponse>('/api/device/check', {
        method: 'POST',
        body: JSON.stringify({ device_fingerprint: fingerprint }),
      }),
  },

  // ── OTP 인증 ───────────────────────────────────────────
  auth: {
    sendOtp: (payload: OtpSendRequest) =>
      request<OtpSendResponse>('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    verifyOtp: (payload: OtpVerifyRequest) =>
      request<OtpVerifyResponse>('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // ── KYC 인증 ───────────────────────────────────────────
  verification: {
    start: (payload: VerificationStartRequest, fingerprint: string) =>
      request<VerificationStartResponse>('/api/verification/start', {
        method: 'POST',
        headers: { 'X-Device-Fingerprint': fingerprint },
        body: JSON.stringify(payload),
      }),
  },

  // ── 프로필 ────────────────────────────────────────────
  profile: {
    setup: (payload: ProfileSetupRequest) =>
      request<ProfileSetupResponse>('/api/profile/setup', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    get: (userId: string) =>
      request<ProfileSetupResponse>(`/api/profile/${userId}`),
  },

  // ── 매칭 ─────────────────────────────────────────────
  matches: {
    list: () =>
      request<Match[]>('/api/matches'),

    like: (targetUserId: string) =>
      request<{ matched: boolean; matchId?: string }>('/api/matches/like', {
        method: 'POST',
        body: JSON.stringify({ target_user_id: targetUserId }),
      }),

    topics: (matchId: string) =>
      request<Topic[]>(`/api/matches/${matchId}/topics`),

    selectTopic: (payload: TopicSelectRequest) =>
      request<TopicSelectResponse>('/api/matches/topic/select', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // ── 채팅 ─────────────────────────────────────────────
  chat: {
    send: (payload: ChatSendRequest) =>
      request<ChatSendResponse>('/api/chat/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    history: (matchId: string, before?: string) =>
      request<{ messages: ChatMessage[] }>(
        `/api/chat/${matchId}/history${before ? `?before=${before}` : ''}`
      ),
  },

  // ── 구독 ─────────────────────────────────────────────
  subscription: {
    upgrade: (payload: SubscriptionUpgradeRequest) =>
      request<SubscriptionUpgradeResponse>('/api/subscription/upgrade', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
};

// ── 에러 판별 유틸 ────────────────────────────────────────
export function isApiError(err: unknown): err is ApiErrorWithStatus {
  return err instanceof Error && 'status' in err;
}

export function isRateLimited(err: unknown): err is ApiErrorWithStatus & { retryAfter: number } {
  return isApiError(err) && err.status === 429;
}

// ChatMessage 타입을 api.ts에서도 export (import 편의)
export type { ChatMessage };
