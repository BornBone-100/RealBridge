'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getClient } from '@/lib/supabase';

// ── 타입 ──────────────────────────────────────────────────
type UserTrack = 'worker' | 'student';
type DocStatus = 'idle' | 'uploading' | 'done' | 'error';

interface DocState {
  file: File | null;
  status: DocStatus;
  preview: string;
  storagePath: string;
}

const initDoc = (): DocState => ({ file: null, status: 'idle', preview: '', storagePath: '' });

// ── Supabase Storage 업로드 헬퍼 ──────────────────────────
async function uploadToStorage(userId: string, docType: string, file: File): Promise<string> {
  const supabase = getClient();
  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/${docType}.${ext}`;
  const { error } = await supabase.storage
    .from('verification-docs')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

const isAcKr = (email: string) => email.trim().toLowerCase().endsWith('.ac.kr');

export default function VerifyDocsPage() {
  const router = useRouter();

  const [track, setTrack] = useState<UserTrack | null>(null);

  // 공통
  const [idCard, setIdCard] = useState<DocState>(initDoc());
  const idCardRef = useRef<HTMLInputElement>(null);

  // 직장인 전용
  const [workEmail, setWorkEmail]         = useState('');
  const [workEmailSent, setWorkEmailSent] = useState(false);
  const [workEmailOk, setWorkEmailOk]     = useState(false);
  const [workEmailCode, setWorkEmailCode] = useState('');
  const [bizCard, setBizCard]             = useState<DocState>(initDoc());
  const [incomeProof, setIncomeProof]     = useState<DocState>(initDoc());
  const bizCardRef = useRef<HTMLInputElement>(null);
  const incomeRef  = useRef<HTMLInputElement>(null);

  // 대학생 전용
  const [uniEmail, setUniEmail]           = useState('');
  const [uniEmailSent, setUniEmailSent]   = useState(false);
  const [uniEmailOk, setUniEmailOk]       = useState(false);
  const [uniEmailCode, setUniEmailCode]   = useState('');
  const [studentId, setStudentId]         = useState<DocState>(initDoc());
  const studentIdRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState('');

  // ── 파일 선택 ──────────────────────────────────────────
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<DocState>>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setter({ file, status: 'idle', preview: URL.createObjectURL(file), storagePath: '' });
  };

  const uploadDoc = async (
    docType: string,
    doc: DocState,
    setter: React.Dispatch<React.SetStateAction<DocState>>,
  ) => {
    if (!doc.file) return;
    setter(d => ({ ...d, status: 'uploading' }));
    try {
      const supabase = getClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');
      const path = await uploadToStorage(user.id, docType, doc.file);
      setter(d => ({ ...d, status: 'done', storagePath: path }));
    } catch (e: unknown) {
      setter(d => ({ ...d, status: 'error' }));
      setError((e as Error).message ?? '업로드 실패');
    }
  };

  // ── 이메일 인증 ──────────────────────────────────────────
  const sendEmailCode = async (email: string, isStudent: boolean) => {
    if (isStudent && !isAcKr(email)) {
      setError('대학교 이메일(.ac.kr)만 사용 가능합니다.');
      return;
    }
    setError('');
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const res = await fetch('/api/verification/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, work_email: email, track: isStudent ? 'student' : 'worker' }),
    });
    if (res.ok) { isStudent ? setUniEmailSent(true) : setWorkEmailSent(true); }
    else setError('인증 코드 발송에 실패했습니다.');
  };

  const verifyEmailCode = async (code: string, isStudent: boolean) => {
    setError('');
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const res = await fetch('/api/verification/email/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, code, track: isStudent ? 'student' : 'worker' }),
    });
    if (res.ok) { isStudent ? setUniEmailOk(true) : setWorkEmailOk(true); }
    else setError('인증 코드가 올바르지 않습니다.');
  };

  // ── 최종 제출 ──────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      const supabase = getClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const body: Record<string, string | null> = {
        user_id: user.id, track: track!,
        id_card_path: idCard.storagePath || null,
      };
      if (track === 'worker') {
        body.business_card_path = bizCard.storagePath || null;
        body.income_proof_path  = incomeProof.storagePath || null;
      } else {
        body.student_id_path = studentId.storagePath || null;
      }

      const res = await fetch('/api/verification/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('제출 실패');

      await supabase.from('users').update({ user_type: track }).eq('id', user.id);
      setSubmitted(true);
    } catch (e: unknown) {
      setError((e as Error).message ?? '제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = (() => {
    if (idCard.status !== 'done') return false;
    if (track === 'worker')  return workEmailOk && bizCard.status === 'done';
    if (track === 'student') return uniEmailOk  && studentId.status === 'done';
    return false;
  })();

  // ── 완료 화면 ────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6 text-center min-h-screen bg-white">
        <div className="text-5xl mb-5">📋</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">서류 제출 완료!</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">
          영업일 기준 1~2일 이내에<br />검토 결과를 문자로 알려드립니다.<br />
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

  // ── 트랙 선택 ────────────────────────────────────────────
  if (!track) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <div className="px-6 pt-14 pb-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-gray-900">신원 인증</h1>
        </div>
        <div className="flex-1 px-6 pt-4">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">어떤 분이세요?</h2>
            <p className="text-sm text-gray-400">인증 트랙에 따라 제출 서류가 달라집니다</p>
          </div>
          <div className="flex flex-col gap-4">
            {[
              {
                id: 'worker' as UserTrack,
                icon: '💼', label: '직장인',
                desc: '직장 이메일 인증 · 신분증 · 명함/사원증\n소득 증빙은 선택 사항',
                tags: ['직장 이메일 ✓', '신분증 ✓', '명함/사원증 ✓', '소득 증빙 (선택)'],
                colors: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'hover:border-blue-200' },
              },
              {
                id: 'student' as UserTrack,
                icon: '🎓', label: '대학(원)생',
                desc: '대학교 이메일(.ac.kr) 인증 · 신분증 · 학생증\n부산 소재 대학교 재학생 대상',
                tags: ['대학 이메일(.ac.kr) ✓', '신분증 ✓', '학생증 ✓'],
                colors: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'hover:border-purple-200' },
              },
            ].map(t => (
              <button key={t.id} onClick={() => setTrack(t.id)}
                className={`w-full text-left border-2 border-gray-100 rounded-3xl p-5
                           active:border-[#0f0f0f] transition-all ${t.colors.border}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${t.colors.bg} flex items-center justify-center text-2xl flex-shrink-0`}>
                    {t.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">{t.label}</p>
                    <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">{t.desc}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {t.tags.map(tag => (
                    <span key={tag} className={`text-[10px] px-2 py-1 rounded-full ${t.colors.bg} ${t.colors.text}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-300 text-center mt-8">
            제출된 서류는 인증 후 즉시 파기되며, 제3자에게 공유되지 않습니다
          </p>
        </div>
      </div>
    );
  }

  // ── 서류 제출 폼 ──────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="px-6 pt-14 pb-4 flex items-center gap-4">
        <button onClick={() => setTrack(null)} className="w-8 h-8 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-base">{track === 'worker' ? '💼' : '🎓'}</span>
          <h1 className="text-base font-semibold text-gray-900">
            {track === 'worker' ? '직장인 인증' : '대학생 인증'}
          </h1>
        </div>
        <span className={`ml-auto text-xs px-2.5 py-1 rounded-full font-medium
          ${track === 'worker' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
          {track === 'worker' ? '직장인' : '대학(원)생'}
        </span>
      </div>

      <div className="flex-1 px-6 pb-10 overflow-y-auto">
        <div className={`border rounded-2xl p-4 mb-6 text-xs leading-relaxed
          ${track === 'worker'
            ? 'bg-blue-50 border-blue-100 text-blue-700'
            : 'bg-purple-50 border-purple-100 text-purple-700'}`}>
          {track === 'worker'
            ? '🔐 3rd Vibe는 실제 직장인 · 대학생만 이용 가능합니다. 제출된 서류는 인증 후 즉시 파기됩니다.'
            : '🎓 부산 소재 대학교(.ac.kr) 재학 중인 분만 이용 가능합니다. 서류는 인증 후 즉시 파기됩니다.'}
        </div>

        {/* ① 이메일 인증 */}
        <Section number="1"
          title={track === 'worker' ? '직장 이메일 인증' : '대학교 이메일 인증 (.ac.kr)'}
          required>
          {track === 'worker'
            ? <EmailVerifier
                email={workEmail} setEmail={setWorkEmail}
                code={workEmailCode} setCode={setWorkEmailCode}
                sent={workEmailSent} verified={workEmailOk}
                placeholder="이름@회사명.com"
                onSend={() => sendEmailCode(workEmail, false)}
                onVerify={() => verifyEmailCode(workEmailCode, false)}
              />
            : <EmailVerifier
                email={uniEmail} setEmail={setUniEmail}
                code={uniEmailCode} setCode={setUniEmailCode}
                sent={uniEmailSent} verified={uniEmailOk}
                placeholder="학번@university.ac.kr"
                hint={uniEmail && !isAcKr(uniEmail) ? '⚠️ .ac.kr 이메일만 사용 가능합니다' : undefined}
                onSend={() => sendEmailCode(uniEmail, true)}
                onVerify={() => verifyEmailCode(uniEmailCode, true)}
              />
          }
        </Section>

        {/* ② 신분증 */}
        <Section number="2" title="신분증 (주민등록증 / 운전면허증)" required>
          <FileUploadBox
            doc={idCard}
            onSelect={e => handleFileSelect(e, setIdCard)}
            onUpload={() => uploadDoc('id_card', idCard, setIdCard)}
            inputRef={idCardRef}
            hint="얼굴과 이름이 선명하게 나온 신분증 앞면"
          />
        </Section>

        {/* ③ 명함(직장인) / 학생증(대학생) */}
        <Section number="3"
          title={track === 'worker' ? '명함 또는 사원증' : '학생증'}
          required>
          {track === 'worker'
            ? <FileUploadBox
                doc={bizCard}
                onSelect={e => handleFileSelect(e, setBizCard)}
                onUpload={() => uploadDoc('business_card', bizCard, setBizCard)}
                inputRef={bizCardRef}
                hint="회사명·이름·직책이 확인되는 명함 또는 사원증"
              />
            : <FileUploadBox
                doc={studentId}
                onSelect={e => handleFileSelect(e, setStudentId)}
                onUpload={() => uploadDoc('student_id', studentId, setStudentId)}
                inputRef={studentIdRef}
                hint="이름과 학교명이 확인되는 학생증 앞면"
              />
          }
        </Section>

        {/* ④ 소득 증빙 (직장인 전용 · 선택) */}
        {track === 'worker' && (
          <Section number="4" title="소득 증빙 서류" optional>
            <FileUploadBox
              doc={incomeProof}
              onSelect={e => handleFileSelect(e, setIncomeProof)}
              onUpload={() => uploadDoc('income_proof', incomeProof, setIncomeProof)}
              inputRef={incomeRef}
              hint="건강보험료 납부 확인서 또는 근로소득 원천징수 영수증"
            />
            <p className="text-xs text-gray-400 mt-2">제출 시 프로필에 '소득 인증' 배지가 표시됩니다</p>
          </Section>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        <button onClick={handleSubmit} disabled={!canSubmit || submitting}
          className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                     disabled:opacity-30 active:scale-[0.98] transition-all mt-4">
          {submitting ? '제출 중...' : '심사 신청하기'}
        </button>
        <p className="text-xs text-gray-400 text-center mt-3">
          영업일 1~2일 · 승인 알림은 문자로 발송됩니다
        </p>
      </div>
    </div>
  );
}

// ── 이메일 인증 서브 컴포넌트 ─────────────────────────────
function EmailVerifier({
  email, setEmail, code, setCode, sent, verified, placeholder, hint, onSend, onVerify,
}: {
  email: string; setEmail: (v: string) => void;
  code: string;  setCode:  (v: string) => void;
  sent: boolean; verified: boolean;
  placeholder: string; hint?: string;
  onSend: () => void; onVerify: () => void;
}) {
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input value={email} onChange={e => setEmail(e.target.value)}
          placeholder={placeholder} type="email" disabled={sent}
          className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm
                     outline-none focus:border-gray-300 disabled:opacity-60" />
        <button onClick={onSend} disabled={sent || !email.includes('@')}
          className="px-4 py-3 bg-[#0f0f0f] text-white text-xs rounded-xl
                     disabled:opacity-40 whitespace-nowrap">
          {sent ? '발송됨 ✓' : '코드 발송'}
        </button>
      </div>
      {hint && <p className="text-xs text-amber-500 mb-2">{hint}</p>}
      {sent && !verified && (
        <div className="flex gap-2">
          <input value={code} onChange={e => setCode(e.target.value)}
            placeholder="6자리 인증 코드" maxLength={6}
            className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm
                       outline-none focus:border-gray-300" />
          <button onClick={onVerify} disabled={code.length < 6}
            className="px-4 py-3 bg-[#0f0f0f] text-white text-xs rounded-xl disabled:opacity-40">
            확인
          </button>
        </div>
      )}
      {verified && <p className="text-xs text-green-600 mt-1">✅ 이메일 인증 완료</p>}
    </div>
  );
}

// ── 섹션 래퍼 ─────────────────────────────────────────────
function Section({ number, title, required, optional, children }: {
  number: string; title: string; required?: boolean; optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-[#0f0f0f] text-white text-xs
                        flex items-center justify-center font-medium flex-shrink-0">
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
          <span className="text-xs text-gray-300 text-center px-4">{hint}</span>
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
          {doc.status === 'done'
            ? <span className="text-xs text-green-600 flex-shrink-0">✅ 완료</span>
            : doc.status === 'uploading'
              ? <svg className="animate-spin w-5 h-5 text-gray-400 flex-shrink-0"
                  fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              : doc.status === 'error'
                ? <button onClick={onUpload}
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg flex-shrink-0">
                    재시도
                  </button>
                : <button onClick={onUpload}
                    className="text-xs px-3 py-1.5 bg-[#0f0f0f] text-white rounded-lg flex-shrink-0">
                    업로드
                  </button>
          }
        </div>
      )}
    </div>
  );
}
