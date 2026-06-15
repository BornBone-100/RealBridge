'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type DocStatus = 'idle' | 'uploading' | 'done' | 'error';

interface DocState {
  file: File | null;
  status: DocStatus;
  preview: string;
}

const initDoc = (): DocState => ({ file: null, status: 'idle', preview: '' });

export default function VerifyDocsPage() {
  const router = useRouter();
  const [workEmail, setWorkEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [businessCard, setBusinessCard] = useState<DocState>(initDoc());
  const [incomeProof, setIncomeProof] = useState<DocState>(initDoc());
  const [idCard, setIdCard] = useState<DocState>(initDoc());
  const [submitted, setSubmitted] = useState(false);

  const businessCardRef = useRef<HTMLInputElement>(null);
  const incomeProofRef  = useRef<HTMLInputElement>(null);
  const idCardRef       = useRef<HTMLInputElement>(null);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<DocState>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setter({ file, status: 'idle', preview });
  };

  const uploadDoc = async (
    doc: DocState,
    setter: React.Dispatch<React.SetStateAction<DocState>>,
    label: string
  ) => {
    if (!doc.file) return;
    setter(d => ({ ...d, status: 'uploading' }));
    // 실제 구현: Supabase Storage upload
    await new Promise(r => setTimeout(r, 1200));
    setter(d => ({ ...d, status: 'done' }));
  };

  const handleSendEmailCode = async () => {
    if (!workEmail.includes('@')) return;
    // 실제: 직장 이메일로 인증 코드 발송 API 호출
    setEmailSent(true);
  };

  const handleVerifyEmail = () => {
    // 실제: 인증 코드 검증 API
    if (emailCode.length === 6) setEmailVerified(true);
  };

  const handleSubmit = async () => {
    // 실제: 서류 심사 신청 API 호출
    setSubmitted(true);
  };

  const canSubmit = emailVerified && businessCard.status === 'done' && idCard.status === 'done';

  if (submitted) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6 text-center min-h-screen">
        <div className="text-5xl mb-5">📋</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">서류 제출 완료!</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">
          영업일 기준 1~2일 이내에<br />
          검토 결과를 문자로 알려드립니다.<br />
          <span className="text-gray-400">승인 후 보증금 결제가 가능합니다.</span>
        </p>
        <div className="w-full bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-8 text-left">
          <p className="text-xs text-amber-700 leading-relaxed">
            ⏳ 심사 중에는 앱을 자유롭게 둘러볼 수 있지만,<br />
            매칭은 승인 후 보증금 결제 완료 시점부터 시작됩니다.
          </p>
        </div>
        <button onClick={() => router.push('/home')}
          className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                     active:scale-[0.98] transition-all">
          홈으로 이동
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 헤더 */}
      <div className="px-6 pt-14 pb-4 flex items-center gap-4">
        <button onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">직장 인증 서류 제출</h1>
      </div>

      <div className="flex-1 px-6 pb-10 overflow-y-auto">
        {/* 안내 */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
          <p className="text-xs text-blue-700 leading-relaxed">
            🔐 3rd Vibe는 <strong>실제 직장인만</strong> 이용 가능합니다.<br />
            제출된 서류는 인증 후 즉시 파기되며, 제3자에게 공유되지 않습니다.
          </p>
        </div>

        {/* 1. 직장 이메일 인증 */}
        <Section number="1" title="직장 이메일 인증" required>
          <div className="flex gap-2 mb-2">
            <input value={workEmail} onChange={e => setWorkEmail(e.target.value)}
              placeholder="이름@회사명.com" type="email"
              className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm
                         outline-none focus:border-gray-300"
              disabled={emailSent} />
            <button onClick={handleSendEmailCode} disabled={emailSent || !workEmail.includes('@')}
              className="px-4 py-3 bg-[#0f0f0f] text-white text-xs rounded-xl
                         disabled:opacity-40 whitespace-nowrap">
              {emailSent ? '발송됨 ✓' : '인증 코드 발송'}
            </button>
          </div>
          {emailSent && !emailVerified && (
            <div className="flex gap-2">
              <input value={emailCode} onChange={e => setEmailCode(e.target.value)}
                placeholder="6자리 인증 코드" maxLength={6}
                className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm
                           outline-none focus:border-gray-300" />
              <button onClick={handleVerifyEmail} disabled={emailCode.length < 6}
                className="px-4 py-3 bg-[#0f0f0f] text-white text-xs rounded-xl disabled:opacity-40">
                확인
              </button>
            </div>
          )}
          {emailVerified && (
            <p className="text-xs text-green-600 mt-1">✅ 이메일 인증 완료</p>
          )}
        </Section>

        {/* 2. 신분증 */}
        <Section number="2" title="신분증 (주민등록증 / 운전면허증)" required>
          <FileUploadBox
            doc={idCard}
            onSelect={e => handleFileSelect(e, setIdCard)}
            onUpload={() => uploadDoc(idCard, setIdCard, '신분증')}
            inputRef={idCardRef}
            hint="얼굴과 이름이 선명하게 나온 신분증 앞면"
          />
        </Section>

        {/* 3. 명함 */}
        <Section number="3" title="명함 또는 사원증" required>
          <FileUploadBox
            doc={businessCard}
            onSelect={e => handleFileSelect(e, setBusinessCard)}
            onUpload={() => uploadDoc(businessCard, setBusinessCard, '명함')}
            inputRef={businessCardRef}
            hint="회사명·이름·직책이 확인되는 명함 또는 사원증"
          />
        </Section>

        {/* 4. 소득 증빙 (선택) */}
        <Section number="4" title="소득 증빙 서류" optional>
          <FileUploadBox
            doc={incomeProof}
            onSelect={e => handleFileSelect(e, setIncomeProof)}
            onUpload={() => uploadDoc(incomeProof, setIncomeProof, '소득 증빙')}
            inputRef={incomeProofRef}
            hint="건강보험료 납부 확인서 또는 근로소득 원천징수 영수증"
          />
          <p className="text-xs text-gray-400 mt-2">
            제출 시 프로필에 '소득 인증' 뱃지가 표시됩니다
          </p>
        </Section>

        <button onClick={handleSubmit} disabled={!canSubmit}
          className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                     disabled:opacity-30 active:scale-[0.98] transition-all mt-4">
          심사 신청하기
        </button>
        <p className="text-xs text-gray-400 text-center mt-3">
          영업일 1~2일 · 승인 알림은 문자로 발송됩니다
        </p>
      </div>
    </div>
  );
}

// ── 섹션 래퍼 ─────────────────────────────────────────────
function Section({ number, title, required, optional, children }: {
  number: string;
  title: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-[#0f0f0f] text-white text-xs flex items-center justify-center font-medium">
          {number}
        </div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {required && <span className="text-xs text-red-400">필수</span>}
        {optional && <span className="text-xs text-gray-400">선택</span>}
      </div>
      {children}
    </div>
  );
}

// ── 파일 업로드 박스 ──────────────────────────────────────
function FileUploadBox({ doc, onSelect, onUpload, inputRef, hint }: {
  doc: DocState;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  hint: string;
}) {
  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={onSelect} />
      {!doc.file ? (
        <button onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-8 flex flex-col
                     items-center gap-2 bg-gray-50 active:bg-gray-100 transition-colors">
          <span className="text-2xl">📎</span>
          <span className="text-xs text-gray-400">탭하여 파일 선택</span>
          <span className="text-xs text-gray-300">{hint}</span>
        </button>
      ) : (
        <div className="border border-gray-100 rounded-2xl p-3 flex items-center gap-3">
          {doc.preview && doc.file.type.startsWith('image/') ? (
            <img src={doc.preview} alt="preview" className="w-12 h-12 rounded-xl object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xl">📄</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700 truncate">{doc.file.name}</p>
            <p className="text-xs text-gray-400">{(doc.file.size / 1024).toFixed(0)} KB</p>
          </div>
          {doc.status === 'done' ? (
            <span className="text-xs text-green-600">✅ 업로드 완료</span>
          ) : doc.status === 'uploading' ? (
            <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          ) : (
            <button onClick={onUpload}
              className="text-xs px-3 py-1.5 bg-[#0f0f0f] text-white rounded-lg">
              업로드
            </button>
          )}
        </div>
      )}
    </div>
  );
}
