'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClient } from '@/lib/supabase';

const INTERESTS = ['여행', '맛집', '카페', '음악', '독서', '운동', '요리', '게임', '영화', '반려동물'];
const MIN_BIO_LENGTH = 100;
const MIN_PHOTOS = 3;
const MAX_PHOTOS = 6;

interface PhotoSlot {
  file: File | null;
  preview: string | null;
}

export default function ProfileSetupPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  // 사진: 최대 6장 슬롯, 최소 3장 필수
  const [photos, setPhotos] = useState<PhotoSlot[]>(
    Array.from({ length: MAX_PHOTOS }, () => ({ file: null, preview: null }))
  );

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [datingValues, setDatingValues] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const filledCount = photos.filter((p) => p.preview !== null).length;

  const toggleInterest = (i: string) =>
    setInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );

  const handleSlotClick = (index: number) => {
    setActiveSlot(index);
    fileRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeSlot === null) return;

    const preview = URL.createObjectURL(file);
    setPhotos((prev) => {
      const next = [...prev];
      next[activeSlot] = { file, preview };
      return next;
    });
    setActiveSlot(null);
    // 에러 클리어
    setErrors((prev) => ({ ...prev, photos: '' }));
    // input 초기화 (같은 파일 재선택 허용)
    e.target.value = '';
  };

  const removePhoto = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotos((prev) => {
      const next = [...prev];
      if (next[index].preview) URL.revokeObjectURL(next[index].preview!);
      next[index] = { file: null, preview: null };
      // 빈 슬롯이 중간에 생기지 않도록 앞으로 당기기
      const filled = next.filter((p) => p.preview !== null);
      const empty = next.filter((p) => p.preview === null);
      return [...filled, ...empty];
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (filledCount < MIN_PHOTOS)
      e.photos = `사진을 ${MIN_PHOTOS}장 이상 등록해 주세요. (현재 ${filledCount}장)`;
    if (!name.trim()) e.name = '이름을 입력해 주세요.';
    if (!age || isNaN(Number(age))) e.age = '나이를 입력해 주세요.';
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

      // 사진 업로드 (채워진 슬롯만)
      const photoUrls: string[] = [];
      const filledPhotos = photos.filter((p) => p.file !== null);

      for (let i = 0; i < filledPhotos.length; i++) {
        const { file } = filledPhotos[i];
        if (!file) continue;
        const ext = file.name.split('.').pop() ?? 'jpg';
        const path = `${user.id}/photo_${i}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(path, file, { upsert: true, contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(path);
        photoUrls.push(`${urlData.publicUrl}?t=${Date.now()}`);
      }

      // 프로필 저장
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
          nationality: 'KR',
          hobbies: interests,
          profile_photo_url: photoUrls[0] ?? null,
          profile_photos: photoUrls,
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

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

        {/* ── 이름 + 나이 ── */}
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

        {/* ── 사진 섹션 ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">
              프로필 사진
              <span className="ml-1 text-red-400">*</span>
            </label>
            <span className={`text-xs font-medium ${filledCount >= MIN_PHOTOS ? 'text-green-500' : 'text-gray-400'}`}>
              {filledCount} / {MIN_PHOTOS}장 이상 필수
            </span>
          </div>

          {/* 안내 문구 */}
          <p className="text-xs text-gray-400 mb-3">
            얼굴이 선명하게 보이는 사진을 {MIN_PHOTOS}장 이상 등록해 주세요.
            선글라스·마스크로 얼굴을 가린 사진은 사용할 수 없습니다.
          </p>

          {/* 사진 그리드 (2×3) */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="grid grid-cols-3 gap-2">
            {photos.map((slot, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSlotClick(idx)}
                className={`relative aspect-square rounded-2xl overflow-hidden border-2
                  ${slot.preview
                    ? 'border-transparent'
                    : idx < MIN_PHOTOS
                      ? 'border-dashed border-yellow-400 bg-yellow-50'
                      : 'border-dashed border-gray-200 bg-gray-50'
                  }`}
              >
                {slot.preview ? (
                  <>
                    <img
                      src={slot.preview}
                      alt={`사진 ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {/* 대표 사진 뱃지 */}
                    {idx === 0 && (
                      <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        대표
                      </span>
                    )}
                    {/* 삭제 버튼 */}
                    <button
                      type="button"
                      onClick={(e) => removePhoto(idx, e)}
                      className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 rounded-full
                                 flex items-center justify-center text-white"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {/* 변경 오버레이 */}
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-medium">변경</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-1">
                    {idx < MIN_PHOTOS ? (
                      <>
                        <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <span className="text-[10px] text-yellow-500 font-medium">필수</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <span className="text-[10px] text-gray-300">선택</span>
                      </>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* 진행 바 */}
          <div className="mt-3 w-full h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300
                ${filledCount >= MIN_PHOTOS ? 'bg-green-400' : 'bg-yellow-400'}`}
              style={{ width: `${Math.min(100, (filledCount / MIN_PHOTOS) * 100)}%` }}
            />
          </div>

          {errors.photos && (
            <p className="text-xs text-red-400 mt-1.5">{errors.photos}</p>
          )}
        </div>

        {/* ── 관심사 ── */}
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

        {/* ── 자기소개 ── */}
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

        {/* ── 연애관 ── */}
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

        {/* ── 제출 버튼 ── */}
        <button
          onClick={handleSubmit}
          disabled={submitting || filledCount < MIN_PHOTOS}
          className="w-full bg-[#0f0f0f] text-white rounded-2xl py-3.5 text-sm font-medium
                     active:scale-[0.98] transition-transform mb-2 disabled:opacity-40"
        >
          {submitting
            ? '저장 중...'
            : filledCount < MIN_PHOTOS
              ? `사진을 ${MIN_PHOTOS - filledCount}장 더 추가해 주세요`
              : '프로필 완성하기'}
        </button>
      </div>
    </div>
  );
}
