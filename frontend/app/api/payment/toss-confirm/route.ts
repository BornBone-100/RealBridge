import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BACKEND_URL        = process.env.NEXT_PUBLIC_API_URL ?? '';
const INTERNAL_SECRET    = process.env.INTERNAL_API_SECRET ?? '';

const TOSS_SECRET_KEY     = process.env.TOSS_SECRET_KEY ?? '';
const SUPABASE_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// 토스페이먼츠 Basic 인증 헤더
function tossAuthHeader() {
  const token = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');
  return `Basic ${token}`;
}

export async function POST(req: NextRequest) {
  try {
    const { paymentKey, orderId, amount } = await req.json() as {
      paymentKey: string;
      orderId: string;
      amount: number;
    };

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json({ message: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    if (!TOSS_SECRET_KEY) {
      return NextResponse.json({ message: '결제 서버 설정 오류입니다.' }, { status: 500 });
    }

    // ① 토스페이먼츠 서버에 결제 승인 요청
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: tossAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossRes.json() as {
      paymentKey?: string;
      orderId?: string;
      totalAmount?: number;
      status?: string;
      receiptUrl?: string;
      code?: string;
      message?: string;
    };

    if (!tossRes.ok || tossData.code) {
      console.error('[Toss confirm error]', tossData);
      return NextResponse.json(
        { message: tossData.message ?? '결제 승인에 실패했습니다.' },
        { status: 400 }
      );
    }

    // ② userId 파싱 (orderId = "3rdvibe-{userId8}-{timestamp}")
    const parts = orderId.split('-');
    const userIdPrefix = parts[1] ?? '';   // userId의 앞 8자

    // ③ Supabase에 결제 내역 저장
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // userIdPrefix로 유저 찾기
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .like('id', `${userIdPrefix}%`)
        .single();

      const userId = userRow?.id ?? null;

      await supabase.from('payments').insert({
        user_id:          userId ?? '00000000-0000-0000-0000-000000000000',
        total_amount:     amount,
        service_fee:      15_000,
        deposit_amount:   25_000,
        status:           'paid',
        toss_payment_key: paymentKey,
        toss_order_id:    orderId,
        paid_at:          new Date().toISOString(),
      });

      // 결제 완료 알림톡 발송 (백엔드 notify 엔드포인트 호출, 실패해도 무시)
      if (userId && BACKEND_URL) {
        fetch(`${BACKEND_URL}/api/notify/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, secret: INTERNAL_SECRET }),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, paymentKey, orderId });
  } catch (e) {
    console.error('[toss-confirm] 예상치 못한 오류:', e);
    return NextResponse.json({ message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
