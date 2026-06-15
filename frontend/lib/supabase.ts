/**
 * RealBridge — Supabase 클라이언트
 * ==================================
 * 브라우저/SSR 환경 모두 지원.
 * RLS는 Supabase Auth JWT로 자동 처리.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── 브라우저 클라이언트 (컴포넌트에서 사용) ───────────────────
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

/** 로그아웃 */
export async function signOut() {
  return supabase.auth.signOut()
}
