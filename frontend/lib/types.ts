// ── 기본 타입 ─────────────────────────────────────────────
export type Nationality = 'KR' | 'JP' | 'TW';
export type IdType = 'passport' | 'id_card';
export type SubscriptionTier = 'basic' | 'truenote';

// ── 유저 ─────────────────────────────────────────────────
export interface User {
  userId: string;
  name: string;
  nationality: Nationality;
  age: number;
  city: string;
  job: string;
  interests: string[];
  bio: string;
  datingValues: string;
  isVerified: boolean;
  subscriptionTier: SubscriptionTier;
  profileImageUrl?: string;
  isTruenote: boolean;
}

// ── 인증 ─────────────────────────────────────────────────
export interface OtpSendRequest {
  phone: string;
  nationality: Nationality;
}

export interface OtpSendResponse {
  message: string;
  expires_in: number; // seconds
}

export interface OtpVerifyRequest {
  phone: string;
  code: string;
}

export interface OtpVerifyResponse {
  message: string;
  user_id: string;
  token: string;
}

export interface VerificationStartRequest {
  user_id: string;
  device_fingerprint: string;
  id_type: IdType;
}

export interface VerificationStartResponse {
  message: string;
  user_id: string;
  sdk_token?: string; // Sumsub SDK 초기화용
}

export interface DeviceCheckResponse {
  is_banned: boolean;
  message?: string;
}

// ── 프로필 ────────────────────────────────────────────────
export interface ProfileSetupRequest {
  user_id: string;
  name: string;
  age: number;
  nationality: Nationality;
  city: string;
  job?: string;
  bio: string;
  dating_values: string;
  interests: string[];
}

export interface ProfileSetupResponse {
  message: string;
  user_id: string;
}

// ── 매칭 & 채팅 ───────────────────────────────────────────
export interface Match {
  id: string;
  userId: string;
  name: string;
  age: number;
  flag: string;
  city: string;
  isTruenote: boolean;
  topicSelected: boolean;
  lastMessage?: string;
  lastTime?: string;
  unread: number;
  gradientFrom: string;
  gradientTo: string;
}

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  text: string;
  translatedText?: string;
  timestamp: string;
  isMe: boolean;
}

export interface ChatSendRequest {
  match_id: string;
  sender_id: string;
  text: string;
  device_fingerprint?: string;
}

export interface ChatSendResponse {
  message_id: string;
  text: string;
  translated_text?: string;
  warning?: {
    type: 'first_warning' | 'account_deleted';
    message: string;
    detected_app: string;
  };
}

// ── 구독 ─────────────────────────────────────────────────
export interface SubscriptionUpgradeRequest {
  user_id: string;
  plan: 'monthly' | 'yearly';
}

export interface SubscriptionUpgradeResponse {
  message: string;
  tier: SubscriptionTier;
  expires_at: string;
}

// ── 토픽 ─────────────────────────────────────────────────
export interface Topic {
  id: string;
  question: string;
  context: string;
  emoji: string;
}

export interface TopicSelectRequest {
  match_id: string;
  user_id: string;
  topic_id: string;
}

export interface TopicSelectResponse {
  message: string;
  both_selected: boolean;
  selected_topic?: Topic;
}

// ── 에러 ─────────────────────────────────────────────────
export interface ApiError {
  detail: string;
}

export interface ApiErrorWithStatus extends Error {
  status: number;
  retryAfter?: number;
}
