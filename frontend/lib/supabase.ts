/**
 * RealBridge — Supabase 클라이언트
 * ==================================
 * 브라우저/SSR 환경 모두 지원.
 * RLS는 Supabase Auth JWT로 자동 처리.
 *
 * ⚠️  OAuth PKCE 주의사항:
 *   - createBrowserClient(@supabase/ssr)는 PKCE code_verifier를 쿠키에 저장
 *   - 서버 /auth/callback 라우트가 쿠키에서 code_verifier를 읽어 code exchange 수행
 *   - @supabase/supabase-js의 createClient는 localStorage에 저장 → 서버에서 못 읽음
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── 브라우저 클라이언트 (컴포넌트에서 사용) ───────────────────
// createBrowserClient: PKCE code_verifier를 쿠키에 저장 → 서버 route에서 교환 가능
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
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

/** 카카오 소셜 로그인 (커스텀 OIDC — account_email 스코프 없이 동작)
 *  Supabase 내장 Kakao OAuth는 항상 account_email 스코프를 포함 → 비즈앱 없이 KOE205 발생
 *  → Kakao OIDC 직접 호출 후 id_token을 signInWithIdToken으로 Supabase 세션 생성
 */
export async function signInWithKakao() {
  if (typeof window === 'undefined') return

  // Kakao REST API Key (공개값 — OAuth URL에 노출됨)
  const KAKAO_REST_KEY = 'a28e0e35e9c557a963d76feb1bcae678'

  // PKCE code_verifier 생성
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const codeVerifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  // code_challenge = SHA-256(code_verifier) base64url
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  sessionStorage.setItem('kakao_cv', codeVerifier)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: KAKAO_REST_KEY,
    redirect_uri: `${window.location.origin}/auth/kakao/callback`,
    scope: 'openid profile_nickname profile_image',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `https://kauth.kakao.com/oauth/authorize?${params}`
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
