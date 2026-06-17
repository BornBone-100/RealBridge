import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PORTONE_API_KEY    = process.env.PORTONE_API_KEY    ?? '';
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET ?? '';
const SUPABASE_URL       = process.env.NEXT_PUBLIC_SUPABASE_URL    ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BACKEND_URL        = process.env.NEXT_PUBLIC_API_URL ?? '';
const INTERNAL_SECRET    = process.env.INTERNAL_API_SECRET ?? '';

const SERVICE_FEE    = 15_000;
const DEPOSIT_AMOUNT = 25_000;
const EXPECTED_TOTAL = SERVICE_FEE + DEPOSIT_AMOUNT; // 40,000

// 포트원 V1 액세스 토큰 발급
async function getPortOneToken(): Promise<string> {
  const res = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imp_key:    PORTONE_API_KEY,
      imp_secret: PORTONE_API_SECRET,
    }),
  });
  const data = await res.json() as { response?: { access_token: string } };
  if (!data.response?.access_token) throw new Error('포트원 토큰 발급 실패');
  return data.response.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const { imp_uid, merchant_uid } = await req.json() as {
      imp_uid: string;
      merchant_uid: string;
    };

    if (!imp_uid || !merchant_uid) {
      return NextResponse.json({ message: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    if (!PORTONE_API_KEY || !PORTONE_API_SECRET) {
      return NextResponse.json({ message: '결제 서버 설정 오류입니다.' }, { status: 500 });
    }

    // ① 포트원 액세스 토큰 발급
    const token = await getPortOneToken();

    // ② 결제 정보 조회
    const payRes = await fetch(`https://api.iamport.kr/payments/${imp_uid}`, {
      headers: { Authorization: token },
    });
    const payData = await payRes.json() as {
      response?: {
        imp_uid: string;
        merchant_uid: string;
        amount: number;
        status: string;
        buyer_name?: string;
        pay_method?: string;
        pg_provider?: string;
      };
      code?: number;
      message?: string;
    };

    if (!payRes.ok || !payData.response) {
      return NextResponse.json({ message: payData.message ?? '결제 조회 실패' }, { status: 400 });
    }

    const payment = payData.response;

    // ③ 위변조 검증
    if (payment.status !== 'paid') {
      return NextResponse.json({ message: `결제 상태 오류: ${payment.status}` }, { status: 400 });
    }
    if (payment.amount !== EXPECTED_TOTAL) {
      return NextResponse.json({ message: '결제 금액 위변조가 감지되었습니다.' }, { status: 400 });
    }
    if (payment.merchant_uid !== merchant_uid) {
      return NextResponse.json({ message: '주문 정보가 일치하지 않습니다.' }, { status: 400 });
    }

    // ④ Supabase에 결제 내역 저장
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // merchant_uid = "3rdvibe-{userId8자리}-{timestamp}"
      const userIdPrefix = merchant_uid.split('-')[1] ?? '';
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .like('id', `${userIdPrefix}%`)
        .single();

      const userId = userRow?.id ?? null;

      // 중복 저장 방지
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('portone_imp_uid', imp_uid)
        .single();

      if (!existing) {
        await supabase.from('payments').insert({
          user_id:          userId ?? '00000000-0000-0000-0000-000000000000',
          total_amount:     EXPECTED_TOTAL,
          service_fee:      SERVICE_FEE,
          deposit_amount:   DEPOSIT_AMOUNT,
          status:           'paid',
          portone_imp_uid:  imp_uid,
          portone_merchant_uid: merchant_uid,
          paid_at:          new Date().toISOString(),
        });

        // users 테이블 결제 완료 플래그 업데이트
        if (userId) {
          await supabase
            .from('users')
            .update({ is_deposit_paid: true })
            .eq('id', userId);

          // 결제 완료 알림톡 발송 (실패해도 무시)
          if (BACKEND_URL) {
            fetch(`${BACKEND_URL}/api/notify/payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: userId, secret: INTERNAL_SECRET }),
            }).catch(() => {});
          }
        }
      }
    }

    return NextResponse.json({ success: true, imp_uid, merchant_uid });
  } catch (e) {
    console.error('[portone-confirm] 오류:', e);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
