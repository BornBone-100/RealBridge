'use client';

/**
 * /admin — 3rd Vibe 운영자 대시보드
 * =====================================
 * 화이트 테마, 충분한 여백, 데이터 밀도 최소화.
 * 탭: 인증 심사 / 신고 유저 / 스캠 감지 로그 / 미해결 알림
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// ── 타입 ──────────────────────────────────────────────────────
type AccountStatus = 'active' | 'pending' | 'banned' | 'suspended';

interface UserRow {
  userId:         string;
  name:           string;
  status:         AccountStatus;
  occupation:     string;
  company:        string;
  reportCount:    number;
  violationCount: number;
  createdAt:      string;
}

interface ScamLog {
  id:            string;
  userId:        string;
  roomId:        string;
  originalText:  string;
  matched:       { pattern: string; category: string; severity: number }[];
  severityScore: number;
  action:        'block' | 'warn' | 'pass';
  createdAt:     string;
}

interface AdminAlert {
  id:        string;
  userId:    string;
  reason:    string;
  status:    'unresolved' | 'resolved';
  createdAt: string;
}

interface VerifyItem {
  userId:        string;
  name:          string;
  phone:         string;
  occupation:    string;
  company:       string;
  hasIdCard:     boolean;
  hasBizCard:    boolean;
  hasIncome:     boolean;
  emailVerified: boolean;
  submittedAt:   string;
}

// ── Mock 데이터 ───────────────────────────────────────────────
const MOCK_USERS: UserRow[] = [
  { userId: 'user_scam1',  name: '???',    occupation: '불명',   company: '불명',     status: 'pending',  reportCount: 3, violationCount: 3, createdAt: '2024-03-01' },
  { userId: 'user_banned', name: '차단됨', occupation: '프리랜서', company: '-',      status: 'banned',   reportCount: 5, violationCount: 7, createdAt: '2023-12-01' },
  { userId: 'user_abc123', name: '이민준', occupation: '개발자',  company: '카카오',  status: 'active',   reportCount: 0, violationCount: 0, createdAt: '2024-01-15' },
  { userId: 'user_def456', name: '정수진', occupation: '간호사',  company: '부산대병원', status: 'active', reportCount: 1, violationCount: 0, createdAt: '2024-04-02' },
];

const MOCK_LOGS: ScamLog[] = [
  { id: 'l1', userId: 'user_scam1',  roomId: 'room_01', originalText: '카카오 아이디 알려드릴게요',  matched: [{ pattern: 'KakaoTalk',      category: 'external_app',    severity: 9  }], severityScore: 9,  action: 'block', createdAt: '2024-06-11T08:23:11Z' },
  { id: 'l2', userId: 'user_scam1',  roomId: 'room_01', originalText: '투자 수익률 보장해드려요',    matched: [{ pattern: 'InvestmentScam', category: 'investment_scam', severity: 10 }], severityScore: 10, action: 'block', createdAt: '2024-06-11T08:25:44Z' },
  { id: 'l3', userId: 'user_abc123', roomId: 'room_02', originalText: 'LINE 교환해요',                matched: [{ pattern: 'LINE',           category: 'external_app',    severity: 9  }], severityScore: 9,  action: 'block', createdAt: '2024-06-11T09:10:02Z' },
  { id: 'l4', userId: 'user_banned', roomId: 'room_03', originalText: '비트코인 투자 해보셨어요?',   matched: [{ pattern: 'CryptoScam',     category: 'investment_scam', severity: 10 }, { pattern: 'InvestmentScam', category: 'investment_scam', severity: 10 }], severityScore: 20, action: 'block', createdAt: '2024-06-10T14:55:00Z' },
];

const MOCK_ALERTS: AdminAlert[] = [
  { id: 'a1', userId: 'user_scam1',  reason: '자동 Pending: 스캠 패턴 3회 적발 — KakaoTalk', status: 'unresolved', createdAt: '2024-06-11T08:25:44Z' },
  { id: 'a2', userId: 'user_abc123', reason: '유저 신고 접수 — fake_profile',                 status: 'unresolved', createdAt: '2024-06-11T09:12:00Z' },
];

const MOCK_VERIFY: VerifyItem[] = [
  { userId: 'user_001', name: '김민준', phone: '010-1234-5678', occupation: '개발자', company: '카카오',    hasIdCard: true, hasBizCard: true,  hasIncome: false, emailVerified: true,  submittedAt: '2024-06-11T10:00:00Z' },
  { userId: 'user_002', name: '이서연', phone: '010-9876-5432', occupation: '간호사', company: '부산대병원', hasIdCard: true, hasBizCard: false, hasIncome: true,  emailVerified: true,  submittedAt: '2024-06-11T11:30:00Z' },
  { userId: 'user_003', name: '박지훈', phone: '010-5555-1234', occupation: '마케터', company: 'CJ',        hasIdCard: true, hasBizCard: true,  hasIncome: true,  emailVerified: false, submittedAt: '2024-06-12T09:00:00Z' },
];

// ── 유틸 ──────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AccountStatus, { label: string; dot: string; text: string; bg: string }> = {
  active:    { label: '정상',    dot: 'bg-green-400',  text: 'text-green-700',  bg: 'bg-green-50'  },
  pending:   { label: '보류',    dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50'  },
  suspended: { label: '정지',    dot: 'bg-orange-400', text: 'text-orange-700', bg: 'bg-orange-50' },
  banned:    { label: '영구정지', dot: 'bg-red-400',    text: 'text-red-700',    bg: 'bg-red-50'    },
};

const ACTION_LABEL: Record<string, { label: string; color: string }> = {
  block: { label: '차단', color: 'text-red-500 bg-red-50' },
  warn:  { label: '경고', color: 'text-amber-600 bg-amber-50' },
  pass:  { label: '통과', color: 'text-green-600 bg-green-50' },
};

const CATEGORY_LABEL: Record<string, string> = {
  external_app:    '외부앱 유도',
  investment_scam: '투자 사기',
  personal_info:   '개인정보',
  malicious_link:  '악성 링크',
  gift_card:       '기프트카드',
  money_request:   '송금 요청',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// ── 액션 버튼 ─────────────────────────────────────────────────
function ActionButtons({ user, onWarn, onBan, onRestore, loading }: {
  user:      UserRow;
  onWarn:    (id: string) => void;
  onBan:     (id: string) => void;
  onRestore: (id: string) => void;
  loading:   string | null;
}) {
  const isLoading = loading === user.userId;
  if (user.status === 'banned') {
    return <span className="text-xs text-gray-300 px-2">영구 정지됨</span>;
  }
  return (
    <div className="flex items-center gap-1.5">
      {user.status === 'pending' && (
        <button onClick={() => onRestore(user.userId)} disabled={isLoading}
          className="text-xs px-3 py-1.5 rounded-full bg-gray-50 text-gray-600
                     border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-40">
          복구
        </button>
      )}
      <button onClick={() => onWarn(user.userId)} disabled={isLoading}
        className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700
                   border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-40">
        경고 발송
      </button>
      <button onClick={() => onBan(user.userId)} disabled={isLoading}
        className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-600
                   border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-40 font-medium">
        {isLoading ? '처리 중…' : '영구 정지'}
      </button>
    </div>
  );
}

// ── 탭 버튼 ───────────────────────────────────────────────────
type Tab = 'verify' | 'users' | 'logs' | 'alerts';

function TabButton({ active, label, badge, onClick }: {
  active: boolean; label: string; badge?: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 text-sm px-1 pb-2.5 border-b-[2px] transition-colors
        ${active ? 'border-[#0f0f0f] text-gray-900 font-medium' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
      {label}
      {badge ? (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
          ${active ? 'bg-[#0f0f0f] text-white' : 'bg-gray-100 text-gray-500'}`}>
          {badge}
        </span>
      ) : null}
    </button>
  );
}

// ── 서류 뱃지 ─────────────────────────────────────────────────
function DocBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border
      ${ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

// ── 인증 심사 패널 ────────────────────────────────────────────
function VerifyPanel({ items }: { items: VerifyItem[] }) {
  const [selected, setSelected]       = useState<VerifyItem | null>(null);
  const [note, setNote]               = useState('');
  const [loading, setLoading]         = useState<string | null>(null);
  const [decisions, setDecisions]     = useState<Record<string, 'approved' | 'rejected'>>({});
  const [toast, setToast]             = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleDecide = async (userId: string, action: 'approve' | 'reject') => {
    setLoading(userId);
    try {
      await fetch(`/api/verification/admin/${action}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: userId, note }),
      });
      setDecisions(d => ({ ...d, [userId]: action === 'approve' ? 'approved' : 'rejected' }));
      showToast(action === 'approve' ? '승인 완료 — 유저에게 SMS 발송됨' : '반려 완료 — 유저에게 사유 전송됨');
      setSelected(null);
      setNote('');
    } catch {
      showToast('오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(null);
    }
  };

  const pending = items.filter(i => !decisions[i.userId]);

  return (
    <div className="flex gap-4 items-start">
      {/* 목록 */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {pending.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <p className="text-3xl mb-3">✅</p>
            <p className="text-sm text-gray-400">심사 대기 항목이 없습니다</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['이름', '직장', '제출 서류', '이메일 인증', '제출일', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-medium text-gray-400 tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pending.map(item => (
                <tr key={item.userId}
                  className={`hover:bg-gray-50/50 transition-colors cursor-pointer
                    ${selected?.userId === item.userId ? 'bg-gray-50' : ''}`}
                  onClick={() => { setSelected(item); setNote(''); }}>
                  {/* 이름 */}
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.phone}</p>
                    </div>
                  </td>
                  {/* 직장 */}
                  <td className="px-5 py-4">
                    <p className="text-xs text-gray-700 font-medium">{item.company}</p>
                    <p className="text-xs text-gray-400">{item.occupation}</p>
                  </td>
                  {/* 서류 */}
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      <DocBadge label="신분증" ok={item.hasIdCard}  />
                      <DocBadge label="명함"   ok={item.hasBizCard} />
                      <DocBadge label="소득"   ok={item.hasIncome}  />
                    </div>
                  </td>
                  {/* 이메일 인증 */}
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium ${item.emailVerified ? 'text-green-600' : 'text-red-400'}`}>
                      {item.emailVerified ? '완료' : '미완'}
                    </span>
                  </td>
                  {/* 제출일 */}
                  <td className="px-5 py-4">
                    <span className="text-xs text-gray-400">{timeAgo(item.submittedAt)}</span>
                  </td>
                  {/* 선택 표시 */}
                  <td className="px-5 py-4">
                    {selected?.userId === item.userId && (
                      <div className="w-2 h-2 rounded-full bg-[#0f0f0f]" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 상세 패널 */}
      {selected && (
        <div className="w-72 flex-shrink-0 bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">심사 상세</h3>

          {/* 유저 정보 */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">이름</span>
              <span className="font-medium text-gray-900">{selected.name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">연락처</span>
              <span className="text-gray-700">{selected.phone}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">직장</span>
              <span className="text-gray-700">{selected.company}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">직종</span>
              <span className="text-gray-700">{selected.occupation}</span>
            </div>
          </div>

          {/* 서류 링크 */}
          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">제출 서류 확인</p>
            <div className="space-y-1.5">
              {selected.hasIdCard && (
                <a href={`/api/verification/docs/${selected.userId}/id_card`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800">
                  <span>📄</span> 신분증 보기
                </a>
              )}
              {selected.hasBizCard && (
                <a href={`/api/verification/docs/${selected.userId}/business_card`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800">
                  <span>💼</span> 명함 보기
                </a>
              )}
              {selected.hasIncome && (
                <a href={`/api/verification/docs/${selected.userId}/income_proof`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800">
                  <span>💰</span> 소득증빙 보기
                </a>
              )}
              {!selected.hasIdCard && !selected.hasBizCard && !selected.hasIncome && (
                <p className="text-xs text-gray-400">제출된 서류 없음</p>
              )}
            </div>
          </div>

          {/* 이메일 인증 상태 */}
          <div className={`rounded-xl px-3 py-2 mb-4 text-xs
            ${selected.emailVerified ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
            직장 이메일 인증: {selected.emailVerified ? '✓ 완료' : '✗ 미완료'}
          </div>

          {/* 메모 */}
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="반려 사유 또는 관리자 메모 (선택)"
            rows={3}
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 mb-3
                       outline-none focus:border-gray-400 resize-none"
          />

          {/* 승인/반려 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => handleDecide(selected.userId, 'approve')}
              disabled={loading === selected.userId}
              className="flex-1 bg-[#0f0f0f] text-white text-xs rounded-xl py-2.5 font-medium
                         disabled:opacity-40 active:scale-[0.98] transition-all">
              {loading === selected.userId ? '처리 중…' : '✓ 승인'}
            </button>
            <button
              onClick={() => handleDecide(selected.userId, 'reject')}
              disabled={loading === selected.userId || !note.trim()}
              className="flex-1 bg-red-50 text-red-600 border border-red-200 text-xs rounded-xl
                         py-2.5 font-medium disabled:opacity-40 active:scale-[0.98] transition-all">
              ✗ 반려
            </button>
          </div>
          {!note.trim() && (
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">반려 시 사유 입력 필수</p>
          )}
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50
                        bg-[#0f0f0f] text-white text-sm px-5 py-3 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── 메인 대시보드 ─────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useCurrentUser();

  const [tab,     setTab]     = useState<Tab>('verify');
  const [users,   setUsers]   = useState<UserRow[]>(MOCK_USERS);
  const [logs]                = useState<ScamLog[]>(MOCK_LOGS);
  const [alerts,  setAlerts]  = useState<AdminAlert[]>(MOCK_ALERTS);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast,   setToast]   = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/'); return; }
    if (profile && !profile.is_admin) { router.replace('/home'); return; }
  }, [authLoading, user, profile, router]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleWarn = useCallback(async (userId: string) => {
    setLoading(userId);
    await new Promise(r => setTimeout(r, 600));
    setUsers(prev => prev.map(u => u.userId === userId ? { ...u, reportCount: u.reportCount + 1 } : u));
    setLoading(null);
    showToast('경고가 발송되었습니다');
  }, []);

  const handleBan = useCallback(async (userId: string) => {
    setLoading(userId);
    await new Promise(r => setTimeout(r, 800));
    setUsers(prev => prev.map(u => u.userId === userId ? { ...u, status: 'banned' } : u));
    setAlerts(prev => prev.map(a => a.userId === userId ? { ...a, status: 'resolved' } : a));
    setLoading(null);
    showToast('계정이 영구 정지되었습니다');
  }, []);

  const handleRestore = useCallback(async (userId: string) => {
    setLoading(userId);
    await new Promise(r => setTimeout(r, 600));
    setUsers(prev => prev.map(u => u.userId === userId ? { ...u, status: 'active' } : u));
    setAlerts(prev => prev.map(a => a.userId === userId ? { ...a, status: 'resolved' } : a));
    setLoading(null);
    showToast('계정이 복구되었습니다');
  }, []);

  if (authLoading || !user || (profile && !profile.is_admin)) {
    return <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
    </div>;
  }

  const unresolvedAlerts = alerts.filter(a => a.status === 'unresolved');
  const pendingUsers     = users.filter(u => u.status === 'pending');

  const STATS = [
    { label: '인증 심사 대기',  value: MOCK_VERIFY.length,                                     color: 'text-blue-500' },
    { label: '미해결 알림',     value: unresolvedAlerts.length,                                 color: 'text-red-500'  },
    { label: '보류 계정',       value: pendingUsers.length,                                     color: 'text-amber-500' },
    { label: '오늘 차단 로그',  value: logs.filter(l => l.action === 'block').length,           color: 'text-gray-900' },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium text-gray-900 tracking-tight">3rd Vibe</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          {unresolvedAlerts.length > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 text-red-600 text-xs px-3 py-1.5 rounded-full border border-red-200">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              알림 {unresolvedAlerts.length}건
            </div>
          )}
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-500">
            관
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* 요약 카드 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {STATS.map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
              <p className="text-xs text-gray-400 mb-1.5">{s.label}</p>
              <p className={`text-3xl font-medium tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div className="flex gap-6 border-b border-gray-100 mb-6">
          <TabButton active={tab === 'verify'} label="인증 심사" badge={MOCK_VERIFY.length}                          onClick={() => setTab('verify')} />
          <TabButton active={tab === 'users'}  label="신고 유저" badge={pendingUsers.length}                         onClick={() => setTab('users')} />
          <TabButton active={tab === 'logs'}   label="감지 로그" badge={logs.filter(l => l.action === 'block').length} onClick={() => setTab('logs')} />
          <TabButton active={tab === 'alerts'} label="알림"      badge={unresolvedAlerts.length}                     onClick={() => setTab('alerts')} />
        </div>

        {/* ── 인증 심사 ──────────────────────────────────────── */}
        {tab === 'verify' && <VerifyPanel items={MOCK_VERIFY} />}

        {/* ── 유저 테이블 ──────────────────────────────────── */}
        {tab === 'users' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['유저', '직장', '상태', '위반', '신고', '가입일', '조치'].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-medium text-gray-400 tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(user => {
                  const sc = STATUS_CONFIG[user.status];
                  return (
                    <tr key={user.userId} className="hover:bg-gray-50/50 transition-colors">
                      {/* 유저 */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-base flex-shrink-0">
                            👤
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{user.userId.slice(0, 12)}</p>
                          </div>
                        </div>
                      </td>
                      {/* 직장 */}
                      <td className="px-5 py-4">
                        <p className="text-xs font-medium text-gray-700">{user.company}</p>
                        <p className="text-xs text-gray-400">{user.occupation}</p>
                      </td>
                      {/* 상태 */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>
                      {/* 위반 */}
                      <td className="px-5 py-4">
                        <span className={`text-sm font-medium tabular-nums ${user.violationCount >= 3 ? 'text-red-500' : 'text-gray-700'}`}>
                          {user.violationCount}회
                        </span>
                      </td>
                      {/* 신고 */}
                      <td className="px-5 py-4">
                        <span className={`text-sm tabular-nums ${user.reportCount >= 3 ? 'text-amber-500 font-medium' : 'text-gray-400'}`}>
                          {user.reportCount}건
                        </span>
                      </td>
                      {/* 가입일 */}
                      <td className="px-5 py-4">
                        <span className="text-xs text-gray-400">{user.createdAt}</span>
                      </td>
                      {/* 조치 버튼 */}
                      <td className="px-5 py-4">
                        <ActionButtons
                          user={user}
                          onWarn={handleWarn}
                          onBan={handleBan}
                          onRestore={handleRestore}
                          loading={loading}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 스캠 감지 로그 ──────────────────────────────── */}
        {tab === 'logs' && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['시간', '유저', '감지 패턴', '심각도', '원문 (일부)', '판정'].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-medium text-gray-400 tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => {
                  const ac = ACTION_LABEL[log.action];
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">{timeAgo(log.createdAt)}</td>
                      <td className="px-5 py-4 text-xs font-mono text-gray-500">{log.userId.slice(0, 12)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {log.matched.map((m, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                              {CATEGORY_LABEL[m.category] ?? m.category}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-sm font-medium tabular-nums
                          ${log.severityScore >= 9 ? 'text-red-500' : log.severityScore >= 5 ? 'text-amber-500' : 'text-gray-500'}`}>
                          {log.severityScore}
                        </span>
                      </td>
                      <td className="px-5 py-4 max-w-[200px]">
                        <p className="text-xs text-gray-500 truncate">{log.originalText}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ac.color}`}>{ac.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 미해결 알림 ─────────────────────────────────── */}
        {tab === 'alerts' && (
          <div className="flex flex-col gap-3">
            {unresolvedAlerts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 px-8 py-12 text-center">
                <p className="text-3xl mb-3">✅</p>
                <p className="text-sm text-gray-400">미해결 알림이 없습니다</p>
              </div>
            ) : unresolvedAlerts.map(alert => {
              const user = users.find(u => u.userId === alert.userId);
              return (
                <div key={alert.id}
                  className="bg-white rounded-2xl border border-amber-200 px-5 py-4
                             flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-gray-900">{user?.name ?? alert.userId}</p>
                        <span className="text-xs text-gray-400">{timeAgo(alert.createdAt)}</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{alert.reason}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => user && handleRestore(user.userId)}
                      className="text-xs px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600">
                      복구
                    </button>
                    <button onClick={() => user && handleBan(user.userId)}
                      className="text-xs px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-600 font-medium">
                      영구 정지
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50
                        bg-[#0f0f0f] text-white text-sm px-5 py-3 rounded-full shadow-lg
                        animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
