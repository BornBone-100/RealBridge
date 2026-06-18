'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getClient } from '@/lib/supabase';

interface NotifSettings {
  new_message: boolean;
  new_intro: boolean;
  date_confirmed: boolean;
  feedback_reminder: boolean;
  match_result: boolean;
  system_notice: boolean;
  sms_enabled: boolean;
}

const DEFAULT: NotifSettings = {
  new_message: true,
  new_intro: true,
  date_confirmed: true,
  feedback_reminder: true,
  match_result: true,
  system_notice: true,
  sms_enabled: true,
};

const SETTINGS = [
  {
    group: '매칭 & 소개팅',
    items: [
      { key: 'new_intro',      icon: '💌', label: '새로운 소개팅',      desc: '새로운 분이 소개됐을 때' },
      { key: 'match_result',   icon: '🎉', label: '매칭 결과',          desc: '3차 만남 상호 결정 결과' },
    ],
  },
  {
    group: '대화 & 일정',
    items: [
      { key: 'new_message',    icon: '💬', label: '새 메시지',          desc: '상대방이 채팅을 보냈을 때' },
      { key: 'date_confirmed', icon: '📅', label: '데이트 일정 확정',    desc: '만남 날짜·장소가 확정됐을 때' },
      { key: 'feedback_reminder', icon: '⭐', label: '피드백 요청',     desc: '데이트 당일 밤 후기 작성 안내' },
    ],
  },
  {
    group: '기타',
    items: [
      { key: 'system_notice',  icon: '📢', label: '공지 & 안내',        desc: '서비스 업데이트, 이벤트 등' },
      { key: 'sms_enabled',    icon: '📱', label: 'SMS 문자 수신',      desc: '중요 알림을 문자로도 받기' },
    ],
  },
] as const;

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0
        ${on ? 'bg-[#0f0f0f]' : 'bg-gray-200'}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
          ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<NotifSettings>(DEFAULT);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/onboarding'); return; }
      setUserId(data.user.id);

      const { data: row } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      if (row) {
        setSettings({
          new_message: row.new_message,
          new_intro: row.new_intro,
          date_confirmed: row.date_confirmed,
          feedback_reminder: row.feedback_reminder,
          match_result: row.match_result,
          system_notice: row.system_notice,
          sms_enabled: row.sms_enabled,
        });
      }
      setLoading(false);
    });
  }, []);

  const update = (key: keyof NotifSettings, val: boolean) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const supabase = getClient();
    await supabase
      .from('notification_settings')
      .upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() },
               { onConflict: 'user_id' });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
      </div>
    );
  }

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
        <h1 className="text-base font-semibold text-gray-900">알림 설정</h1>
      </div>

      {/* 설정 그룹 */}
      <div className="flex-1 px-4 pt-4 space-y-4 pb-32">
        {SETTINGS.map(group => (
          <div key={group.group}>
            <p className="text-xs text-gray-400 font-medium px-1 mb-2">{group.group}</p>
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {group.items.map(item => (
                <div key={item.key}
                  className="flex items-center gap-3 px-4 py-4">
                  <span className="text-xl w-7 text-center">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                  </div>
                  <Toggle
                    on={settings[item.key as keyof NotifSettings]}
                    onChange={v => update(item.key as keyof NotifSettings, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="text-[11px] text-gray-400 text-center px-4 leading-relaxed">
          알림을 끄더라도 중요한 매칭 결과는 앱 내 알림으로 전달됩니다.
        </p>
      </div>

      {/* 저장 버튼 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 pb-8 pt-3
                      bg-white border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-4 rounded-2xl text-sm font-semibold transition-all
            ${saved
              ? 'bg-green-500 text-white'
              : 'bg-[#0f0f0f] text-white active:scale-[0.98] disabled:opacity-50'}`}>
          {saving ? '저장 중...' : saved ? '✓ 저장됨' : '설정 저장'}
        </button>
      </div>
    </div>
  );
}
