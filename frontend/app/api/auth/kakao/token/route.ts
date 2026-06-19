import { NextRequest, NextResponse } from 'next/server'

const KAKAO_REST_KEY = 'a28e0e35e9c557a963d76feb1bcae678'
const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token'

export async function POST(request: NextRequest) {
  const { code, codeVerifier, redirectUri } = await request.json()

  if (!code || !codeVerifier || !redirectUri) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: KAKAO_REST_KEY,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
  })

  const res = await fetch(KAKAO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: body.toString(),
  })

  const data = await res.json()

  if (data.error) {
    console.error('[kakao/token] 카카오 토큰 교환 실패:', data)
    return NextResponse.json(
      {
        error: data.error_description ?? data.error,
        kakaoError: data.error,
        kakaoErrorDesc: data.error_description,
        httpStatus: res.status,
      },
      { status: 400 }
    )
  }

  if (!data.id_token) {
    console.error('[kakao/token] id_token 없음 (openid scope 미포함?):', data)
    return NextResponse.json({ error: 'no_id_token' }, { status: 400 })
  }

  return NextResponse.json({ idToken: data.id_token })
}
