import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '아동 안전 표준 | 3rd Vibe',
  description: '3rd Vibe 아동 성적 학대 및 착취(CSAE) 방지 정책',
};

export default function ChildSafetyPage() {
  return (
    <main className="px-5 py-8 text-sm text-gray-700 leading-relaxed">
      <h1 className="text-xl font-bold text-gray-900 mb-6">아동 안전 표준 (Child Safety Standards)</h1>

      <p className="mb-6 text-gray-500 text-xs">시행일: 2026년 6월 29일</p>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">1. 무관용 정책 (Zero-Tolerance Policy)</h2>
        <p className="mb-3">
          3rd Vibe(이하 "서비스")는 아동 성적 학대 및 착취(Child Sexual Abuse and Exploitation, CSAE)에 대해 무관용 원칙을 적용합니다.
          미성년자(만 18세 미만)는 서비스를 이용할 수 없으며, 미성년자를 대상으로 하는 성적 콘텐츠, 그루밍, 착취 행위는
          즉각적인 계정 영구 정지 및 관련 당국 신고 조치가 이루어집니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">2. 아동 성적 학대물(CSAM) 금지</h2>
        <p className="mb-3">
          서비스 내에서 아동 성적 학대물(Child Sexual Abuse Material, CSAM)의 생성, 배포, 저장, 공유는 엄격히 금지됩니다.
          이를 위반할 경우 즉시 계정을 영구 정지하고, 관련 법령에 따라 수사 기관에 신고합니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">3. 연령 인증</h2>
        <p className="mb-3">
          모든 이용자는 가입 시 본인 명의 휴대폰 번호 및 신분증을 통한 본인 인증을 필수로 완료해야 합니다.
          만 18세 미만으로 확인된 경우 서비스 이용이 즉시 차단됩니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">4. 신고 및 대응</h2>
        <p className="mb-3">
          이용자는 아동 안전과 관련된 우려 사항을 아래 이메일로 신고할 수 있습니다. 모든 신고는 24시간 이내에 검토되며,
          법적 조치가 필요한 경우 즉각적으로 관련 당국에 보고합니다.
        </p>
        <p className="mb-2 font-medium">신고 이메일: <a href="mailto:rdfg6834@naver.com" className="text-purple-600">rdfg6834@naver.com</a></p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">5. 법규 준수</h2>
        <p className="mb-3">
          3rd Vibe는 아동 안전과 관련된 대한민국 및 모든 관련 국제 법규를 준수합니다.
          아동 성적 학대 관련 콘텐츠가 발견되면 즉시 삭제하고, 국내외 관련 당국(경찰청 사이버범죄수사대, 방송통신심의위원회 등)에 신고합니다.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">6. 연락처</h2>
        <p>아동 안전 관련 문의 및 신고: <a href="mailto:rdfg6834@naver.com" className="text-purple-600">rdfg6834@naver.com</a></p>
      </section>
    </main>
  );
}
