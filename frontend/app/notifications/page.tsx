'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getClient } from '@/lib/supabase';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  data: Record<string, string> | null;
  created_at: string;
}

const TYPE_ICON: Record<string, string> = {
  new_message:       '💬',
  new_intro:         '💌',
  date_confirmed:    '📅',
  feedback:          '⭐',
  match_result:      '🎉',
  system:            '📢',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/onboarding'); return; }
      setUserId(data.user.id);

      const { data: rows } = await supabase
        .from('notifications')
        .select('id, type, title, body, is_read, data, created_at')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setNotifications((rows ?? []) as Notification[]);
      setLoading(false);

      // 모두 읽음 처리
      if (rows && rows.some(r => !r.is_read)) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', data.user.id)
          .eq('is_read', false);
      }
    });
  }, []);

  const handleTap = (notif: Notification) => {
    const d = notif.data;
    if (!d) return;
    if (d.match_id && notif.type === 'new_message') router.push(`/chat/${d.match_id}`);
    else if (notif.type === 'new_intro' && d.match_id) router.push(`/matches`);
    else if (notif.type === 'date_confirmed' && d.match_id) router.push(`/chat/${d.match_id}`);
    else if (notif.type === 'feedback' && d.milestone_id) {
      router.push(`/date-feedback?mid=${d.milestone_id}&no=${d.milestone_no ?? 1}`);
    } else if (notif.type === 'match_result') router.push('/matches');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900 flex-1">알림</h1>
        <button onClick={() => router.push('/profile/notifications')}
          className="text-xs text-gray-400 border border-gray-200 rounded-full px-3 py-1.5">
          설정
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="text-5xl">🔔</div>
          <p className="text-base font-medium text-gray-900">아직 알림이 없어요</p>
          <p className="text-sm text-gray-400">새로운 소식이 생기면 여기서 확인할 수 있어요</p>
        </div>
      ) : (
        <div className="flex-1 px-4 pt-3 pb-8 space-y-1">
          {notifications.map(notif => (
            <button
              key={notif.id}
              onClick={() => handleTap(notif)}
              className={`w-full flex items-start gap-3 px-4 py-4 rounded-2xl text-left
                transition-colors active:bg-gray-100
                ${notif.is_read ? 'bg-white' : 'bg-white border border-gray-100 shadow-sm'}`}
            >
              {/* 아이콘 */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                text-lg ${notif.is_read ? 'bg-gray-100' : 'bg-gray-900'}`}>
                {notif.is_read
                  ? <span>{TYPE_ICON[notif.type] ?? '📢'}</span>
                  : <span className="grayscale-0">{TYPE_ICON[notif.type] ?? '📢'}</span>}
              </div>

              {/* 텍스트 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm leading-snug ${notif.is_read ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>
                    {notif.title}
                  </p>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                    {timeAgo(notif.created_at)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed line-clamp-2">
                  {notif.body}
                </p>
              </div>

              {/* 읽지 않음 점 */}
              {!notif.is_read && (
                <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 mt-1.5" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
