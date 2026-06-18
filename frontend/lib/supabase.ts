/**
 * RealBridge — Supabase 클라이언트
 * ==================================
 * 브라우저/SSR 환경 모두 지원.
 * RLS는 Supabase Auth JWT로 자동 처리.
 */

import { createClient as _createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── 브라우저 클라이언트 (컴포넌트에서 사용) ───────────────────
// localStorage에 세션을 저장 → 브라우저를 닫았다 열어도 로그인 유지
export function createClient() {
  return _createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,   // OAuth 콜백 URL 자동 처리
      storageKey: '3rdvibe-auth',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  })
}

// ── 싱글톤 (훅/유틸에서 바로 사용) — lazy 초기화 ──────────────
let _client: ReturnType<typeof createClient> | null = null
export function getClient() {
  if (!_client) _client = createClient()
  return _client
}
/** @deprecated use getClient() instead */
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_t, prop) {
    return (getClient() as never)[prop as never]
  },
})

// ── Auth 헬퍼 ─────────────────────────────────────────────────

/** 현재 로그인 유저의 access_token 반환 (API 요청 헤더용) */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/** 현재 로그인 유저 ID 반환 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/** 전화번호 OTP 발송 */
export async function sendPhoneOtp(phone: string) {
  return supabase.auth.signInWithOtp({ phone })
}

/** OTP 검증 */
export async function verifyPhoneOtp(phone: string, token: string) {
  return supabase.auth.verifyOtp({ phone, token, type: 'sms' })
}

/** Google 소셜 로그인 */
export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=/onboarding`,
    },
  })
}

/** 카카오 소셜 로그인 */
export async function signInWithKakao() {
  return supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=/onboarding`,
    },
  })
}

/** 로그아웃 (세션 삭제, 전화번호는 localStorage에 유지) */
export async function signOut() {
  return supabase.auth.signOut()
}

// ── 저장된 전화번호 (e.164 형식) ──────────────────────────────
const SAVED_PHONE_KEY = '3rdvibe-saved-phone'

export function getSavedPhone(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SAVED_PHONE_KEY)
}

export function setSavedPhone(phone: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SAVED_PHONE_KEY, phone)
}

export function clearSavedPhone() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SAVED_PHONE_KEY)
}
