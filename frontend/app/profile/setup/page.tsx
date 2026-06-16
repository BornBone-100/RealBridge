'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Nationality } from '@/lib/types';
import { getClient } from '@/lib/supabase';

const INTERESTS = ['여행', '맛집', '카페', '음악', '독서', '운동', '요리', '게임', '영화', '반려동물'];
const NATIONALITIES: { code: Nationality; label: string; flag: string }[] = [
  { code: 'KR', label: '한국', flag: '🇰🇷' },
  { code: 'JP', label: '일본', flag: '🇯🇵' },
  { code: 'TW', label: '대만', flag: '🇹🇼' },
];
const MIN_BIO_LENGTH = 100;

export default function ProfileSetupPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [nationality, setNationality] = useState<Nationality | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [datingValues, setDatingValues] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const toggleInterest = (i: string) =>
    setInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!imageUrl) e.image = '프로필 사진을 등록해 주세요.';
    if (!name.trim()) e.name = '이름을 입력해 주세요.';
    if (!age || isNaN(Number(age))) e.age = '나이를 입력해 주세요.';
    if (!nationality) e.nationality = '국적을 선택해 주세요.';
    if (interests.length < 1) e.interests = '관심사를 1개 이상 선택해 주세요.';
    if (bio.length < MIN_BIO_LENGTH)
      e.bio = `자기소개를 ${MIN_BIO_LENGTH}자 이상 작성해 주세요. (현재 ${bio.length}자)`;
    if (!datingValues.trim()) e.datingValues = '연애관을 작성해 주세요.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || submitting) return;
    setSubmitting(true);

    try {
      const supabase = getClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      // 1. 사진 업로드
      let photoUrl: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop() ?? 'jpg';
        const path = `${user.id}/profile.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(path, imageFile, { upsert: true, contentType: imageFile.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(path);
        // 캐시 무력화용 타임스탬프 추가
        photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      // 2. 프로필 저장
      const currentYear = new Date().getFullYear();
      const birthYear = currentYear - Number(age);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertError } = await (supabase
        .from('users')
        .upsert({
          id: user.id,
          name: name.trim(),
          birth_year: birthYear,
          bio: bio.trim(),
          ...(nationality && { nationality }),
          hobbies: interests,
          profile_photo_url: photoUrl,
          is_active: true,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'id' }) as any);

      if (upsertError) throw upsertError;

      router.push('/home');
    } catch (err) {
      console.error('프로필 저장 실패:', err);
      setErrors((prev) => ({ ...prev, submit: '저장에 실패했습니다. 다시 시도해 주세요.' }));
    } finally {
      setSubmitting(false);
    }
  };

  const bioOk = bio.length >= MIN_BIO_LENGTH;

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* 헤더 */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 z-10">
        <button onClick={() => router.back()} aria-label="뒤로가기" className="text-gray-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <p className="text-xs text-gray-400">프로필 설정</p>
          <h1 className="text-base font-medium text-gray-900 leading-tight">나를 소개해 주세요</h1>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="text-sm font-medium text-[#0f0f0f] bg-gray-100 px-4 py-1.5 rounded-full disabled:opacity-40"
        >
          {submitting ? '저장 중...' : '완료'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {/* 프로필 사진 */}
        <div className="flex flex-col items-center gap-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          <button
            onClick={() => fileRef.current?.click()}
            className="relative w-24 h-24 rounded-3xl overflow-hidden border-2 border-dashed
                       border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1"
          >
            {imageUrl ? (
              <img src={imageUrl} alt="프로필" className="w-full h-full object-cover" />
            ) : (
              <>
                <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                <span className="text-xs text-gray-300">사진 추가</span>
              </>
            )}
            {/* 변경 오버레이 */}
            {imageUrl && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-white text-xs font-medium">변경</span>
              </div>
            )}
          </button>
          {errors.image && <p className="text-xs text-red-400">{errors.image}</p>}
          <p className="text-xs text-gray-400">얼굴이 명확히 보이는 사진을 등록해 주세요</p>
        </div>

        {/* 이름 + 나이 */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1.5 block">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="실명 입력"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm
                         text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400"
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          </div>
          <div className="w-20">
            <label className="text-xs text-gray-400 mb-1.5 block">나이</label>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="25"
              type="number"
              min={18} max={60}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm
                         text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400"
            />
            {errors.age && <p className="text-xs text-red-400 mt-1">{errors.age}</p>}
          </div>
        </div>

        {/* 국적 */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block">국적</label>
          <div className="flex gap-2">
            {NATIONALITIES.map((n) => (
              <button
                key={n.code}
                onClick={() => setNationality(n.code)}
                className={`flex-1 py-2.5 rounded-xl text-sm border transition-all
                  ${nationality === n.code
                    ? 'border-[#0f0f0f] bg-[#0f0f0f] text-white'
                    : 'border-gray-200 text-gray-600'}`}
              >
                {n.flag} {n.label}
              </button>
            ))}
          </div>
          {errors.nationality && <p className="text-xs text-red-400 mt-1">{errors.nationality}</p>}
        </div>

        {/* 관심사 */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block">관심사 (복수 선택)</label>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <button
                key={i}
                onClick={() => toggleInterest(i)}
                className={`px-3.5 py-1.5 rounded-full text-xs border transition-all
                  ${interests.includes(i)
                    ? 'border-[#0f0f0f] bg-[#0f0f0f] text-white'
                    : 'border-gray-200 text-gray-500'}`}
              >
                {i}
              </button>
            ))}
          </div>
          {errors.interests && <p className="text-xs text-red-400 mt-1">{errors.interests}</p>}
        </div>

        {/* 자기소개 */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs text-gray-400">자기소개</label>
            <span className={`text-xs ${bioOk ? 'text-green-500' : 'text-gray-300'}`}>
              {bio.length} / {MIN_BIO_LENGTH}자
            </span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="어떤 사람인지, 어떤 일상을 보내는지 자유롭게 적어주세요. (100자 이상)"
            rows={4}
            className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm
                       text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400
                       resize-none leading-relaxed"
          />
          {!bioOk && bio.length > 0 && (
            <div className="w-full h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-[#0f0f0f] rounded-full transition-all"
                style={{ width: `${Math.min(100, (bio.length / MIN_BIO_LENGTH) * 100)}%` }}
              />
            </div>
          )}
          {errors.bio && <p className="text-xs text-red-400 mt-1">{errors.bio}</p>}
        </div>

        {/* 연애관 */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">
            연애관 <span className="text-gray-300">(장거리 연애, 미래 계획 등)</span>
          </label>
          <textarea
            value={datingValues}
            onChange={(e) => setDatingValues(e.target.value)}
            placeholder="장거리 연애에 대한 생각, 바라는 관계의 모습을 적어주세요."
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm
                       text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400
                       resize-none leading-relaxed"
          />
          {errors.datingValues && <p className="text-xs text-red-400 mt-1">{errors.datingValues}</p>}
        </div>

        {errors.submit && (
          <p className="text-xs text-red-400 text-center">{errors.submit}</p>
        )}

        {/* 제출 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                     active:scale-[0.98] transition-transform mb-2 disabled:opacity-50"
        >
          {submitting ? '저장 중...' : '프로필 완성하기'}
        </button>
      </div>
    </div>
  );
}
