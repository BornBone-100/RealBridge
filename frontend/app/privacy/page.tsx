import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침 | 3rd Vibe',
  description: '3rd Vibe 개인정보처리방침',
};

export default function PrivacyPage() {
  return (
    <main className="px-5 py-8 text-sm text-gray-700 leading-relaxed">
      <h1 className="text-xl font-bold text-gray-900 mb-6">개인정보처리방침</h1>

      <p className="mb-6 text-gray-500 text-xs">시행일: 2025년 1월 1일 · 최종 수정일: 2026년 6월 23일</p>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">1. 개인정보 수집 항목 및 목적</h2>
        <p className="mb-3">
          3rd Vibe(이하 "서비스")는 다음 개인정보를 수집합니다.
        </p>
        <ul className="space-y-2 text-gray-600">
          <li><span className="font-medium text-gray-800">회원가입 시:</span> 이름, 생년월일, 성별, 휴대폰 번호, 직업, 거주지역, 프로필 사진</li>
          <li><span className="font-medium text-gray-800">본인인증 시:</span> 신분증 정보(이름·생년월일 일치 확인 후 즉시 파기), 셀카 사진</li>
          <li><span className="font-medium text-gray-800">서비스 이용 시:</span> 매칭 이력, 채팅 메시지, 접속 로그, 기기 정보(OS·앱 버전)</li>
          <li><span className="font-medium text-gray-800">결제 시:</span> 결제 수단 정보(카드사에 직접 전송, 당사 미보관)</li>
        </ul>
        <p className="mt-3 text-gray-600">
          수집 목적: 회원 식별, 매칭 서비스 제공, 부정 이용 방지, 고객 지원, 서비스 개선
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">2. 개인정보 보유 및 이용 기간</h2>
        <ul className="space-y-2 text-gray-600">
          <li><span className="font-medium text-gray-800">회원 탈퇴 시:</span> 지체 없이 파기 (단, 아래 예외 적용)</li>
          <li><span className="font-medium text-gray-800">계약·청약철회 기록:</span> 5년 (전자상거래법)</li>
          <li><span className="font-medium text-gray-800">접속 로그:</span> 3개월 (통신비밀보호법)</li>
          <li><span className="font-medium text-gray-800">부정 이용 기록:</span> 1년 (서비스 안전 목적)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">3. 개인정보 제3자 제공</h2>
        <p className="text-gray-600">
          3rd Vibe는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
          단, 법령에 의한 수사기관 요청, 서비스 제공을 위한 수탁사(SMS 인증, 결제대행사 등)에게는
          최소한의 정보를 제공할 수 있습니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">4. 개인정보 처리 위탁</h2>
        <ul className="space-y-2 text-gray-600">
          <li><span className="font-medium text-gray-800">Solapi:</span> SMS·카카오 알림톡 발송</li>
          <li><span className="font-medium text-gray-800">Supabase Inc.:</span> 데이터베이스 및 파일 저장</li>
          <li><span className="font-medium text-gray-800">Vercel Inc.:</span> 웹 서비스 호스팅</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">5. 이용자의 권리</h2>
        <p className="mb-2 text-gray-600">
          이용자는 언제든지 다음 권리를 행사할 수 있습니다.
        </p>
        <ul className="space-y-2 text-gray-600">
          <li>• 개인정보 열람·정정·삭제 요청</li>
          <li>• 개인정보 처리 정지 요청</li>
          <li>• 회원 탈퇴 (앱 내 설정 → 계정 관리 → 탈퇴)</li>
        </ul>
        <p className="mt-3 text-gray-600">
          요청 접수 후 10영업일 이내에 처리합니다. 고객센터 이메일: <span className="text-gray-800">rdfg6834@gmail.com</span>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">6. 개인정보 보호책임자</h2>
        <ul className="space-y-1 text-gray-600">
          <li><span className="font-medium text-gray-800">성명:</span> 김성준</li>
          <li><span className="font-medium text-gray-800">직위:</span> 대표</li>
          <li><span className="font-medium text-gray-800">연락처:</span> 010-5900-6834</li>
          <li><span className="font-medium text-gray-800">이메일:</span> rdfg6834@gmail.com</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">7. 개인정보 자동 수집 (쿠키 등)</h2>
        <p className="text-gray-600">
          서비스는 로그인 유지 및 서비스 개선을 위해 세션 쿠키와 로컬 스토리지를 사용합니다.
          브라우저 설정에서 쿠키를 거부할 수 있으나, 일부 서비스 이용이 제한될 수 있습니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">8. 개인정보처리방침 변경</h2>
        <p className="text-gray-600">
          본 방침이 변경될 경우 앱 내 공지 또는 이메일로 사전 고지합니다.
          변경된 방침은 고지 후 7일이 경과한 날부터 효력이 발생합니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">9. 개인정보 침해 신고</h2>
        <p className="text-gray-600">
          개인정보 침해 관련 신고·상담은 아래 기관에 문의하실 수 있습니다.
        </p>
        <ul className="mt-2 space-y-1 text-gray-600">
          <li>• 개인정보 침해신고센터: privacy.kisa.or.kr (국번없이 118)</li>
          <li>• 개인정보 분쟁조정위원회: www.kopico.go.kr (1833-6972)</li>
          <li>• 대검찰청 사이버수사과: www.spo.go.kr (02-3480-3573)</li>
          <li>• 경찰청 사이버안전국: cyberbureau.police.go.kr (국번없이 182)</li>
        </ul>
      </section>

      <div className="border-t border-gray-100 pt-6">
        <p className="text-xs text-gray-400">
          사업자명: 3rd Vibe · 사업자등록번호: 494-37-01613<br />
          대표자: 김성준 · 주소: 경상남도 창원시 마산합포구 현동9길 13, 103동 503호
        </p>
      </div>
    </main>
  );
}
