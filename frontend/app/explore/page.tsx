'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClient } from '@/lib/supabase';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface BusanUser {
  id: string;
  name: string;
  birth_year: number;
  district: string | null;
  occupation: string | null;
  mbti: string | null;
  hobbies: string[] | null;
  verification_status: string;
}

const GRADIENTS = [
  { from: '#dbeafe', to: '#ede9fe' },
  { from: '#d1fae5', to: '#cffafe' },
  { from: '#fce7f3', to: '#fef3c7' },
  { from: '#fef3c7', to: '#fde8d5' },
];
const EMOJIS = ['🌊', '🌸', '☕', '🏄', '🌿', '✨', '🎨', '🎵'];
const DISTRICTS = ['전체', '해운대구', '수영구', '남구', '부산진구', '동래구'];

export default function ExplorePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useCurrentUser();
  const [users, setUsers] = useState<BusanUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeDistrict, setActiveDistrict] = useState('전체');

  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      const supabase = getClient();
      let query = supabase
        .from('users')
        .select('id, name, birth_year, district, occupation, mbti, hobbies, verification_status')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(30);
      if (user) query = query.neq('id', user.id);
      const { data } = await query;
      setUsers(data ?? []);
      setLoading(false);
    };
    load();
  }, [user, authLoading]);

  const filtered = users.filter(u => {
    const matchDistrict = activeDistrict === '전체' || u.district === activeDistrict;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      u.name.toLowerCase().includes(q) ||
      (u.district ?? '').includes(q) ||
      (u.occupation ?? '').includes(q) ||
      (u.hobbies ?? []).some(h => h.toLowerCase().includes(q));
    return matchDistrict && matchSearch;
  });

  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen">
      {/* 헤더 */}
      <div className="px-6 pt-14 pb-3">
        <h1 className="text-xl font-medium text-gray-900">탐색</h1>
        <p className="text-sm text-gray-400 mt-0.5">부산에서 새로운 인연을 만나보세요</p>
      </div>

      {/* 검색바 */}
      <div className="px-5 mb-3">
        <div className="flex items-center gap-2.5 bg-gray-50 rounded-2xl px-4 py-3">
          <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이름, 구, 관심사 검색"
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-300 outline-none" />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 부산 구 필터 */}
      <div className="px-5 mb-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {DISTRICTS.map(d => (
            <button key={d} onClick={() => setActiveDistrict(d)}
              className={`flex-shrink-0 text-xs px-3.5 py-2 rounded-full border transition-colors
                ${activeDistrict === d
                  ? 'bg-[#0f0f0f] text-white border-[#0f0f0f]'
                  : 'bg-white text-gray-500 border-gray-200'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <div className="text-5xl">🌊</div>
          <p className="text-base font-medium text-gray-900">
            {search || activeDistrict !== '전체' ? '검색 결과가 없어요' : '아직 등록된 유저가 없어요'}
          </p>
          <p className="text-sm text-gray-400 leading-relaxed">
            {search || activeDistrict !== '전체'
              ? '다른 검색어나 지역을 선택해 보세요'
              : '홈 탭에서 프로필을 탐색하고\n매칭을 시작해 보세요!'}
          </p>
          {!search && activeDistrict === '전체' && (
            <button onClick={() => router.push('/home')}
              className="mt-1 bg-[#0f0f0f] text-white px-6 py-3 rounded-full text-sm font-medium">
              홈으로 가기
            </button>
          )}
        </div>
      ) : (
        <div className="px-5 grid grid-cols-2 gap-3 pb-24">
          {filtered.map((u, idx) => {
            const age = new Date().getFullYear() - u.birth_year;
            const g = GRADIENTS[idx % GRADIENTS.length];
            const emoji = EMOJIS[idx % EMOJIS.length];
            return (
              <button key={u.id} onClick={() => router.push('/home')}
                className="text-left rounded-3xl overflow-hidden border border-gray-100
                           active:scale-[0.97] transition-transform">
                <div className="h-36 flex items-center justify-center text-5xl"
                  style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}>
                  {emoji}
                </div>
                <div className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-medium text-gray-900">{u.name}, {age}</span>
                    {u.verification_status === 'approved' && (
                      <span className="bg-[#0f0f0f] text-white text-[8px] px-1.5 py-0.5 rounded-full leading-none">✓</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{u.district ?? '부산'}{u.occupation ? ` · ${u.occupation}` : ''}</p>
                  <div className="flex flex-wrap gap-1">
                    {(u.hobbies ?? []).slice(0, 2).map(tag => (
                      <span key={tag} className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
