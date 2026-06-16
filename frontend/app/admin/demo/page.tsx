'use client'

/**
 * 관리자 매칭 시뮬레이션 데모 페이지
 * 예시 프로필과 매칭했을 때 전체 플로우(SMS → 채팅 → 일정 → 피드백)를 시각화
 */

import { useState } from 'react'

// ── 예시 프로필 ──────────────────────────────────────────
const DEMO_PROFILES = [
  {
    id: 'demo_1',
    name: '김지은',
    age: 27,
    job: '마케팅 매니저',
    company: '카카오',
    userType: 'worker' as const,
    district: '해운대구',
    mbti: 'ENFP',
    bio: '부산 바다 옆에서 커피 한 잔 하는 걸 좋아해요. 맛집 탐방이 취미고, 같이 웃을 수 있는 사람을 찾고 있어요 😊',
    tags: ['카페 투어', '영화', '요리'],
    emoji: '☕',
    gradient: 'from-rose-400 to-pink-500',
    compatScore: 94,
    matchReason: '연락 빈도·데이트 스타일·갈등 해결 방식이 높게 일치',
  },
  {
    id: 'demo_2',
    name: '박소연',
    age: 24,
    job: '경영학과 4학년',
    company: '부산대학교',
    userType: 'student' as const,
    district: '금정구',
    mbti: 'ISFJ',
    bio: '학업과 여행의 밸런스를 찾고 있어요. 진지하게 만나서 함께 성장할 수 있는 분을 기다리고 있습니다.',
    tags: ['독서', '여행', '운동'],
    emoji: '📚',
    gradient: 'from-violet-400 to-purple-500',
    compatScore: 88,
    matchReason: '장거리 연애 허용 여부·흡연 여부·종교관이 일치',
  },
  {
    id: 'demo_3',
    name: '이하늘',
    age: 29,
    job: '간호사',
    company: '부산대병원',
    userType: 'worker' as const,
    district: '남구',
    mbti: 'INFJ',
    bio: '바쁜 일상 속에서도 소중한 인연을 찾고 싶어요. 작은 것에 감사할 줄 아는 따뜻한 분과 함께하고 싶습니다.',
    tags: ['드라이브', '맛집', '산책'],
    emoji: '🌸',
    gradient: 'from-sky-400 to-blue-500',
    compatScore: 91,
    matchReason: '연애 가치관·미래 계획·부산 선호 장소가 높게 일치',
  },
]

// ── 매칭 후 플로우 단계 ──────────────────────────────────
const FLOW_STEPS = [
  {
    step: 1,
    icon: '📱',
    title: 'SMS 매칭 알림',
    timing: '매칭 즉시',
    color: 'bg-rose-50 border-rose-200',
    badge: 'bg-rose-100 text-rose-700',
    description: '관리자 번호(010-5900-6834)로 매칭 성사 문자 발송',
    smsPreview: (name: string) =>
      `[3rd Vibe] 새로운 매칭이 성사되었습니다! 🎉\n${name}님과 매칭되었어요.\n앱에서 채팅을 시작해 보세요.`,
  },
  {
    step: 2,
    icon: '💬',
    title: '채팅창 개방',
    timing: '매칭 직후',
    color: 'bg-violet-50 border-violet-200',
    badge: 'bg-violet-100 text-violet-700',
    description: '1:1 채팅방이 생성되고 아이스브레이킹 카드 게임이 시작됩니다',
    chatPreview: (name: string) => [
      { from: 'system', msg: `${name}님과 채팅이 시작되었습니다 👋` },
      { from: 'system', msg: '아이스브레이킹 카드로 대화를 시작해 보세요!' },
      { from: 'card', msg: '🃏 Q. 지금 이 순간 어디서든 순간이동할 수 있다면?' },
    ],
  },
  {
    step: 3,
    icon: '🃏',
    title: '아이스브레이킹 카드',
    timing: '채팅 시작 시',
    color: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    description: '랜덤 질문 카드로 어색함을 자연스럽게 풀어줍니다',
    cards: [
      '주말 아침, 눈 뜨자마자 제일 먼저 하는 일은?',
      '가장 최근에 크게 웃었던 순간은 언제인가요?',
      '이상적인 첫 데이트 장소를 고른다면?',
    ],
  },
  {
    step: 4,
    icon: '📅',
    title: '첫 데이트 일정 제안',
    timing: '매칭 후 3일 내',
    color: 'bg-emerald-50 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    description: '앱 내 캘린더로 첫 만남 일정을 조율합니다 (공개 장소 권장)',
    dateInfo: {
      place: '해운대 카페거리 (공개 장소 권장)',
      time: '오후 2시 ~ 4시',
      tip: '낮 시간대 카페에서 만나는 것을 권장드립니다',
    },
  },
  {
    step: 5,
    icon: '⭐',
    title: '만남 후 피드백 SMS',
    timing: '만남 당일 저녁',
    color: 'bg-sky-50 border-sky-200',
    badge: 'bg-sky-100 text-sky-700',
    description: '만남 완료 후 자동으로 피드백 요청 SMS가 발송됩니다',
    smsPreview: (name: string) =>
      `[3rd Vibe] ${name}님과의 첫 만남은 어떠셨나요?\n솔직한 피드백을 남겨주시면 더 좋은 매칭을 도와드릴게요 💌`,
  },
]

export default function AdminDemoPage() {
  const [selectedProfile, setSelectedProfile] = useState<typeof DEMO_PROFILES[0] | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [matched, setMatched] = useState(false)
  const [smsSending, setSmsSending] = useState(false)
  const [smsResult, setSmsResult] = useState<'idle' | 'sent' | 'error'>('idle')

  const handleMatch = (profile: typeof DEMO_PROFILES[0]) => {
    setSelectedProfile(profile)
    setMatched(true)
    setActiveStep(1)
    // 자동으로 스텝 순서대로 보여주기
    let step = 1
    const interval = setInterval(() => {
      step += 1
      if (step > FLOW_STEPS.length) {
        clearInterval(interval)
        return
      }
      setActiveStep(step)
    }, 1200)
  }

  const handleSendTestSms = async () => {
    if (!selectedProfile) return
    setSmsSending(true)
    setSmsResult('idle')
    try {
      const res = await fetch('/api/demo/send-test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: '01059006834',
          matched_name: selectedProfile.name,
        }),
      })
      setSmsResult(res.ok ? 'sent' : 'error')
    } catch {
      setSmsResult('error')
    } finally {
      setSmsSending(false)
    }
  }

  const handleReset = () => {
    setSelectedProfile(null)
    setMatched(false)
    setActiveStep(0)
    setSmsResult('idle')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔬</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900">관리자 매칭 시뮬레이션</h1>
              <p className="text-sm text-gray-500">예시 프로필로 전체 매칭 플로우를 체험해 보세요</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <span className="text-base">📞</span>
            <span className="text-sm text-amber-800">
              관리자 번호: <span className="font-semibold">010-5900-6834</span>으로 알림이 발송됩니다
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-6">

        {/* ── 예시 프로필 선택 ── */}
        {!matched && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              예시 프로필 선택
            </h2>
            <div className="space-y-3">
              {DEMO_PROFILES.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  {/* 그라디언트 배너 */}
                  <div className={`h-2 bg-gradient-to-r ${p.gradient}`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${p.gradient} flex items-center justify-center text-2xl`}>
                          {p.emoji}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{p.name}</span>
                            <span className="text-sm text-gray-500">{p.age}세</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              p.userType === 'worker'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {p.userType === 'worker' ? '💼 직장인' : '🎓 대학생'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{p.job} · {p.district}</p>
                          <p className="text-xs text-gray-400 mt-0.5">MBTI: {p.mbti}</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-rose-500">{p.compatScore}%</div>
                        <div className="text-xs text-gray-400">궁합</div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-700 mt-3 leading-relaxed">{p.bio}</p>

                    <div className="flex gap-2 mt-3 flex-wrap">
                      {p.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                          # {tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 p-2.5 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">매칭 근거:</span> {p.matchReason}
                      </p>
                    </div>

                    <button
                      onClick={() => handleMatch(p)}
                      className={`mt-4 w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r ${p.gradient} shadow-sm active:opacity-90 transition-opacity`}
                    >
                      이 분과 매칭 시뮬레이션 시작 →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 매칭 성사 결과 ── */}
        {matched && selectedProfile && (
          <>
            {/* 매칭 카드 */}
            <div className={`bg-gradient-to-br ${selectedProfile.gradient} rounded-2xl p-5 text-white shadow-lg`}>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">
                  {selectedProfile.emoji}
                </div>
                <div>
                  <p className="text-white/80 text-sm">매칭 성사! 🎉</p>
                  <h2 className="text-xl font-bold">{selectedProfile.name}님과 매칭되었습니다</h2>
                  <p className="text-white/80 text-sm mt-0.5">궁합 {selectedProfile.compatScore}% · {selectedProfile.district}</p>
                </div>
              </div>
              <div className="mt-4 bg-white/20 rounded-xl p-3">
                <p className="text-white/90 text-sm leading-relaxed">{selectedProfile.bio}</p>
              </div>
            </div>

            {/* SMS 테스트 발송 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📱</span>
                <h3 className="font-semibold text-gray-900">실제 SMS 테스트 발송</h3>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 mb-4 font-mono text-sm text-green-400 leading-relaxed">
                {(FLOW_STEPS[0] as {smsPreview: (n: string) => string}).smsPreview(selectedProfile.name)}
              </div>
              {smsResult === 'sent' && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
                  ✅ 010-5900-6834으로 SMS 발송 완료!
                </div>
              )}
              {smsResult === 'error' && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  ❌ 발송 실패. 백엔드 서버 실행 여부를 확인해 주세요.
                </div>
              )}
              <button
                onClick={handleSendTestSms}
                disabled={smsSending}
                className="w-full py-3 rounded-xl font-semibold bg-gray-900 text-white disabled:opacity-50 transition-opacity"
              >
                {smsSending ? '발송 중...' : '📨 내 번호로 테스트 SMS 보내기'}
              </button>
            </div>

            {/* ── 플로우 타임라인 ── */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                매칭 후 전체 플로우
              </h2>
              <div className="space-y-3">
                {FLOW_STEPS.map((flow, idx) => {
                  const isActive = activeStep >= flow.step
                  return (
                    <div
                      key={flow.step}
                      className={`rounded-2xl border p-4 transition-all duration-500 ${
                        isActive ? flow.color : 'bg-white border-gray-100 opacity-40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                          isActive ? 'bg-white shadow-sm' : 'bg-gray-100'
                        }`}>
                          {flow.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{flow.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${flow.badge}`}>
                              {flow.timing}
                            </span>
                            {isActive && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                ✓ 완료
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{flow.description}</p>
                        </div>
                      </div>

                      {/* 세부 내용 */}
                      {isActive && (
                        <div className="mt-3">
                          {/* SMS 미리보기 */}
                          {'smsPreview' in flow && (
                            <div className="bg-white rounded-xl p-3 border border-gray-100">
                              <p className="text-xs text-gray-400 mb-1 font-medium">SMS 내용 미리보기</p>
                              <p className="text-xs text-gray-700 leading-relaxed font-mono whitespace-pre-line">
                                {((flow as {smsPreview?: (n: string) => string}).smsPreview ?? (() => ''))(selectedProfile.name)}
                              </p>
                            </div>
                          )}

                          {/* 채팅 미리보기 */}
                          {'chatPreview' in flow && (
                            <div className="bg-white rounded-xl p-3 border border-gray-100 space-y-2">
                              <p className="text-xs text-gray-400 font-medium">채팅 예시</p>
                              {((flow as {chatPreview?: (n: string) => {from: string, msg: string}[]}).chatPreview ?? (() => []))(selectedProfile.name).map((msg, i) => (
                                <div key={i} className={`text-xs px-3 py-2 rounded-xl ${
                                  msg.from === 'card'
                                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {msg.msg}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 아이스브레이킹 카드 */}
                          {'cards' in flow && (
                            <div className="space-y-2">
                              {((flow as {cards?: string[]}).cards ?? []).map((card, i) => (
                                <div key={i} className="bg-white rounded-xl px-3 py-2.5 border border-amber-100 text-xs text-gray-700 flex items-start gap-2">
                                  <span className="text-amber-500 font-bold mt-0.5">Q{i + 1}.</span>
                                  {card}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 데이트 정보 */}
                          {'dateInfo' in flow && (
                            <div className="bg-white rounded-xl p-3 border border-emerald-100 text-xs space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span>📍</span>
                                <span className="text-gray-700">{((flow as {dateInfo?: {place: string, time: string, tip: string}}).dateInfo?.place ?? '')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span>🕐</span>
                                <span className="text-gray-700">{((flow as {dateInfo?: {place: string, time: string, tip: string}}).dateInfo?.time ?? '')}</span>
                              </div>
                              <div className="flex items-center gap-2 bg-emerald-50 rounded-lg p-2">
                                <span>💡</span>
                                <span className="text-emerald-700">{((flow as {dateInfo?: {place: string, time: string, tip: string}}).dateInfo?.tip ?? '')}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* 리셋 버튼 */}
            <button
              onClick={handleReset}
              className="w-full py-3.5 rounded-2xl border border-gray-200 text-gray-600 font-semibold bg-white"
            >
              ← 다른 프로필로 다시 시뮬레이션
            </button>
          </>
        )}
      </div>
    </div>
  )
}
