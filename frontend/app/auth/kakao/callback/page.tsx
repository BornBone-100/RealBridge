'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function KakaoCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('카카오 로그인 처리 중...')

  useEffect(() => {
    const handle = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')

      if (error || !code) {
        setStatus('로그인 실패. 돌아갑니다...')
        router.replace(`/?error=${error ?? 'no_code'}`)
        return
      }

      const codeVerifier = sessionStorage.getItem('kakao_cv')
      if (!codeVerifier) {
        setStatus('세션 오류. 다시 시도해 주세요.')
        router.replace('/?error=missing_verifier')
        return
      }

      // 1) 서버에서 Kakao 토큰 교환
      const redirectUri = `${window.location.origin}/auth/kakao/callback`
      const tokenRes = await fetch('/api/auth/kakao/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, codeVerifier, redirectUri }),
      })
      const tokenData = await tokenRes.json()
      const { idToken, error: tokenError, kakaoError, kakaoErrorDesc, httpStatus } = tokenData

      if (tokenError || !idToken) {
        console.error('[kakao/callback] 토큰 교환 실패:', tokenError, '| kakaoError:', kakaoError, '| kakaoErrorDesc:', kakaoErrorDesc, '| httpStatus:', httpStatus, '| full:', tokenData)
        setStatus('토큰 교환 실패. 다시 시도해 주세요.')
        router.replace('/?error=token_exchange_failed')
        return
      }

      // 2) Supabase에 id_token으로 로그인
      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'kakao',
        token: idToken,
      })

      if (authError) {
        console.error('[kakao/callback] Supabase signInWithIdToken 실패:', authError)
        setStatus('로그인 실패. 다시 시도해 주세요.')
        router.replace('/?error=signin_failed')
        return
      }

      // 3) 완료
      sessionStorage.removeItem('kakao_cv')
      router.replace('/onboarding')
    }

    handle()
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white text-sm">{status}</p>
      </div>
    </div>
  )
}

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <KakaoCallbackInner />
    </Suspense>
  )
}
