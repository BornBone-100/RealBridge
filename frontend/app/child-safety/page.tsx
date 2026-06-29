import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '아동 안전 표준 | 3rd Vibe',
    description: '3rd Vibe 아동 성적 학대 및 착취(CSAE) 방지 정책',
};

export default function ChildSafetyPage() {
    return (
          <main className="px-5 py-8 text-sm text-gray-700 leading-relaxed">
                <h1 className="text-xl font-bold text-gray-900 mb-6">아동 안전 표준 (Child Safety Standards)</h1>h1>
                <p className="mb-6 text-gray-500 text-xs">시행일: 2026년 6월 29일</p>p>
                <section className="mb-8">
                        <h2 className="text-base font-semibold text-gray-900 mb-3">1. 무관용 정책</h2>h2>
                        <p>3rd Vibe는 아동 성적 학대 및 착취(CSAE)에 대해 무관용 원칙을 적용합니다. 만 18세 미만은 서비스를 이용할 수 없으며, 미성년자 대상 성적 콘텐츠·그루밍·착취 행위 시 즉각 영구 정지 및 관련 당국 신고합니다.</p>p>
                </section>section>
                <section className="mb-8">
                        <h2 className="text-base font-semibold text-gray-900 mb-3">2. CSAM 금지</h2>h2>
                        <p>서비스 내 아동 성적 학대물(CSAM)의 생성·배포·저장·공유는 엄격히 금지됩니다. 위반 시 계정 즉시 영구 정지 및 수사 기관 신고합니다.</p>p>
                </section>section>
                <section className="mb-8">
                        <h2 className="text-base font-semibold text-gray-900 mb-3">3. 연령 인증</h2>h2>
                        <p>모든 이용자는 가입 시 본인 명의 휴대폰 및 신분증 인증을 필수로 완료해야 합니다. 만 18세 미만으로 확인 시 즉시 이용이 차단됩니다.</p>p>
                </section>section>
                <section className="mb-8">
                        <h2 className="text-base font-semibold text-gray-900 mb-3">4. 신고</h2>h2>
                        <p>아동 안전 관련 우려 사항은 <a href="mailto:rdfg6834@naver.com">rdfg6834@naver.com</a>a>으로 신고하세요. 24시간 이내 검토 후 법적 조치가 필요한 경우 관련 당국에 보고합니다.</p>p>
                </section>section>
                <section className="mb-8">
                        <h2 className="text-base font-semibold text-gray-900 mb-3">5. 법규 준수</h2>h2>
                        <p>3rd Vibe는 아동 안전 관련 대한민국 및 국제 법규를 준수하며, CSAM 발견 시 즉시 삭제하고 경찰청 사이버범죄수사대 등 관련 당국에 신고합니다.</p>p>
                </section>section>
          </main>main>
        );
}</main>
