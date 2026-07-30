import { describe, expect, test } from 'bun:test'
import { grade } from './grading'
import { parseTime } from './pace'
import { weekDays, weeklyPlan } from './plan'
import { type AthleteQuote, QUOTES } from './quotes'
import { buildQuiz, quizVerdict } from './terms'
import type { Body, Profile, RecordEntry } from './types'
import {
  CAFE_URL,
  dayHtml,
  drylandHtml,
  drylandResultsHtml,
  escapeHtml,
  gradingHtml,
  HOME_HTML,
  NEEDS_BODY_HTML,
  quizAnswerHtml,
  quizQuestionHtml,
  quizResultHtml,
  quoteHtml,
  recordsHtml,
  SPLASH_HTML,
  splitsHtml,
  termsHtml,
  termsResultsHtml,
  trainingHtml,
} from './view'

const body: Body = { heightCm: 172, weightKg: 68 }

const athleteQuotes = QUOTES.filter((quote): quote is AthleteQuote => quote.kind === 'athlete')

const profile: Profile = {
  ageGroup: '45-49',
  sex: 'M',
  goal: {
    event: { stroke: 'free', distance: 100 },
    targetCs: parseTime('1:22.00')!,
    currentCs: parseTime('1:28.00')!,
  },
  load: { sessionsPerWeek: 3, metersPerSession: 2000 },
}

const grading = grade(profile.goal.currentCs, profile.goal.event, profile.sex, profile.load)
const plan = weeklyPlan(profile, grading)
const days = weekDays(plan)

describe('escapeHtml', () => {
  test('꺾쇠와 앰퍼샌드를 막는다', () => {
    expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;')
  })
})

describe('시작 화면과 메뉴', () => {
  test('시작 화면에는 로고와 ENTER 만 있다', () => {
    expect(SPLASH_HTML).toContain('logo.png')
    expect(SPLASH_HTML).toContain('ENTER')
    expect(SPLASH_HTML).toContain('id="enter"')
  })

  test('메뉴에 두 기능으로 가는 링크가 있다', () => {
    expect(HOME_HTML).toContain('#/training')
    expect(HOME_HTML).toContain('#/records')
  })

  test('어록 카드에 문장·이름·출처·사진 저작자가 모두 들어간다', () => {
    const quote = athleteQuotes.find((q) => q.photo && q.source)!
    const html = quoteHtml(quote)
    expect(html).toContain(escapeHtml(quote.text))
    expect(html).toContain(quote.name)
    expect(html).toContain(`./quotes/${quote.id}.jpg`)
    // CC BY 계열의 조건이라 화면에서 빠지면 안 된다.
    expect(html).toContain(quote.photo!.by)
    expect(html).toContain(quote.photo!.license)
    expect(html).toContain(quote.source!)
  })

  test('사진이 없으면 팀 마크를 넣고 사진 표시는 빼낸다', () => {
    const quote = athleteQuotes.find((q) => q.photo === undefined)!
    const html = quoteHtml(quote)
    expect(html).toContain('quote-photo mark')
    expect(html).toContain('./mark.png')
    expect(html).not.toContain('.jpg')
    // 팀 마크는 남의 사진이 아니므로 저작자 표시가 붙지 않는다.
    expect(html).not.toContain('사진 ')
    // 문장의 출처는 사진이 없어도 그대로 뜬다.
    expect(html).toContain(quote.source!)
  })

  // 확인한 문장과 그렇지 않은 문장이 화면에서 구별돼야 한다(ADR-0009).
  test('출처가 없으면 링크 대신 출처 미확인이라고 적는다', () => {
    const quote = athleteQuotes.find((q) => q.source === undefined)!
    const html = quoteHtml(quote)
    expect(html).toContain('출처 미확인')
    // 사진 라이선스 링크는 남지만 어록 출처 링크는 없다.
    expect(html).not.toContain(`>${quote.said}</a>`)
  })

  // 지은이가 없으므로 이름·사진·출처를 놓을 자리가 아예 없다.
  test('지은이 없는 문구는 팀 마크와 두 줄만 있고 귀속 표시가 없다', () => {
    const saying = QUOTES.find((q) => q.kind === 'saying')!
    const html = quoteHtml(saying)
    expect(html).toContain('quote saying')
    expect(html).toContain(escapeHtml(saying.text))
    expect(html).toContain('./mark.png')
    expect(html).not.toContain('quote-source')
    expect(html).not.toContain('출처 미확인')
    expect(html).not.toContain('.jpg')
  })

  // 사진이 없는 카드는 팀 마크를 쓴다. 오프라인에서 빈칸이 되지 않으려면
  // 서비스워커가 이 파일도 캐시해야 한다.
  test('팀 마크가 서비스워커 셸에 들어 있다', async () => {
    expect(await Bun.file('src/sw.ts').text()).toContain('./mark.png')
    expect(await Bun.file('web/mark.png').exists()).toBe(true)
  })

  test('어록 카드의 바깥 링크는 opener 를 넘기지 않는다', () => {
    for (const quote of QUOTES) {
      const html = quoteHtml(quote)
      const links = html.match(/target="_blank"/g) ?? []
      const safe = html.match(/rel="noopener noreferrer"/g) ?? []
      expect(safe.length).toBe(links.length)
    }
  })

  test('메뉴 맨 아래에 팀 카페로 나가는 링크가 있다', () => {
    expect(HOME_HTML).toContain('나인틴 훈련일정 확인')
    expect(HOME_HTML).toContain(CAFE_URL)
    // 새 탭으로 나가되 opener 를 넘기지 않는다.
    expect(HOME_HTML).toContain('rel="noopener noreferrer"')
    expect(HOME_HTML.indexOf(CAFE_URL)).toBeGreaterThan(HOME_HTML.indexOf('#/records'))
  })
})

describe('훈련 로그', () => {
  const trainingDay = days.find((day) => day.session !== null)!

  test('훈련일에 완주 개수를 받는 칸이 나온다', () => {
    const html = dayHtml(profile, trainingDay, 7, [], false, '2026-07-26')
    expect(html).toContain('id="log-reps"')
    expect(html).toContain('완주 기록')
  })

  test('휴식일에는 완주 칸이 없다', () => {
    const restDay = days.find((day) => day.session === null)!
    expect(dayHtml(profile, restDay, 7, [], false, '2026-07-26')).not.toContain('log-reps')
  })

  test('계획 개수가 세트 지시문과 일치한다', () => {
    const html = dayHtml(profile, trainingDay, 7, [], false, '2026-07-26')
    // 100m 목표 · 강도/분량 중급이면 주 세트는 레이스 페이스 50 8회다
    expect(html).toContain('data-planned="8"')
    expect(html).toContain('계획 8개 중')
  })

  test('기록이 없으면 판정을 보류한다', () => {
    expect(dayHtml(profile, trainingDay, 7, [], false, '2026-07-26')).toContain('남기면 목표가 적절한지')
  })

  test('세 번 연속 못 채우면 목표가 이르다고 알린다', () => {
    const logs = ['2026-07-10', '2026-07-15', '2026-07-20'].map((date) => ({
      date,
      methodId: 'rp50',
      plannedReps: 8,
      completedReps: 3,
    }))
    const html = dayHtml(profile, trainingDay, 7, logs, false, '2026-07-26')
    expect(html).toContain('too-hard')
    expect(html).toContain('이른 목표')
  })

  test('오늘 이미 남긴 값은 되불러 수정할 수 있다', () => {
    const logs = [{ date: '2026-07-26', methodId: 'rp50', plannedReps: 8, completedReps: 6 }]
    const html = dayHtml(profile, trainingDay, 7, logs, false, '2026-07-26')
    expect(html).toContain('value="6"')
    expect(html).toContain('>수정<')
  })
})

describe('trainingHtml', () => {
  const html = trainingHtml(profile, grading, plan, days, 0)

  test('목표 페이스가 들어간다', () => expect(html).toContain('20.68'))
  test('단축 폭이 들어간다', () => expect(html).toContain('6.8%'))
  test('구간 목표 표가 들어간다', () => expect(html).toContain('대회 구간 목표'))

  test('하루씩 보여준다 — 세션 카드가 한 장뿐이다', () => {
    expect(html.match(/class="session/g)).toHaveLength(1)
  })

  test('날짜를 넘기는 조작부가 있다', () => {
    expect(html).toContain('day-prev')
    expect(html).toContain('day-next')
  })

  test('닫히지 않은 태그가 없다', () => {
    const tags = 'article|ul|li|table|tbody|thead|tr|div|span|strong|p|h2|h3|h4|section|nav|figure'
    const opens = (html.match(new RegExp(`<(${tags})\\b`, 'g')) ?? []).length
    const closes = (html.match(new RegExp(`</(${tags})>`, 'g')) ?? []).length
    expect(opens).toBe(closes)
  })
})

describe('dayHtml', () => {
  const trainingDay = days.find((day) => day.session !== null)!
  const restDay = days.find((day) => day.session === null)!

  test('훈련일에는 세트가 나온다', () => {
    expect(dayHtml(profile, trainingDay, 7)).toContain('주 세트')
  })

  test('휴식일에는 세트 대신 회복 안내가 나온다', () => {
    const html = dayHtml(profile, restDay, 7)
    expect(html).toContain('휴식')
    expect(html).not.toContain('주 세트')
  })

  test('신체 데이터가 없으면 식단이 잠기고 이유를 밝힌다', () => {
    const html = dayHtml(profile, trainingDay, 7)
    expect(html).toContain(NEEDS_BODY_HTML)
    expect(html).toContain('이 기기에만 저장')
  })

  test('키·체중이 있으면 훈련일 식단이 계산된다', () => {
    const html = dayHtml({ ...profile, body }, trainingDay, 7)
    expect(html).toContain('훈련일 식단')
    expect(html).toContain('곡류')
    expect(html).toContain('단백질 목표')
  })

  test('휴식일 식단은 훈련일과 구분되고 수영 소모가 없다', () => {
    const html = dayHtml({ ...profile, body }, restDay, 7)
    expect(html).toContain('휴식일 식단')
    expect(html).not.toContain('· 수영 ')
  })

  test('식단에 근거를 밝힌다', () => {
    expect(dayHtml({ ...profile, body }, trainingDay, 7)).toContain('KDRIs')
  })

  // 하루 화면의 주인공은 그날의 세트다. 식단은 눌러야 펼쳐진다.
  test('식단은 기본적으로 접혀 있다', () => {
    const html = dayHtml({ ...profile, body }, trainingDay, 7)
    expect(html).toContain('<details class="diet"')
    expect(html).not.toContain(' open>')
  })

  test('펼친 상태를 넘기면 열린 채로 그린다 — 요일을 넘겨도 유지된다', () => {
    const html = dayHtml({ ...profile, body }, trainingDay, 7, [], true)
    expect(html).toContain(' open>')
  })
})

describe('지상훈련 화면', () => {
  test('고른 영법의 세트와 공통 세트가 함께 나온다', () => {
    const html = drylandHtml('breast')
    expect(html).toContain('평영')
    expect(html).toContain('어깨를 지킨다')
    expect(html).not.toContain('접영</h3>')
  })

  test('영상 링크가 새 탭으로 나가고 채널명이 함께 뜬다', () => {
    const html = drylandHtml('free')
    expect(html).toContain('https://www.youtube.com/watch?v=')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('class="channel"')
  })

  test('영상마다 미리보기 그림이 붙는다', () => {
    const html = drylandHtml('free')
    expect(html).toContain('https://img.youtube.com/vi/')
    expect(html).toContain('loading="lazy"')
  })

  // 그림이 못 오면 스스로 빠지고 제목·채널명이 남아야 한다.
  test('그림이 실패하면 스스로 빠진다', () => {
    expect(drylandHtml('free')).toContain('onerror="this.remove()"')
  })

  // 제목이 바로 옆에 글로 있다. alt 에 같은 말을 넣으면 두 번 읽어준다.
  test('미리보기 그림의 alt 는 비어 있다', () => {
    expect(drylandHtml('free')).toContain('alt=""')
  })

  // 그림이 늦게 와도 글이 밀리면 안 된다.
  test('미리보기 그림에 크기가 박혀 있다', () => {
    const html = drylandHtml('free')
    expect(html).toContain('width="320"')
    expect(html).toContain('height="180"')
  })

  // 내용을 보증하지 않는다는 사실이 화면에 있어야 한다.
  test('영상을 보증하지 않는다는 안내가 있다', () => {
    expect(drylandHtml('free')).toContain('보증하지 않습니다')
  })

  test('영법 선택이 지금 보는 영법에 맞춰져 있다', () => {
    expect(drylandHtml('back')).toContain('<option value="back" selected>')
  })

  // `why` 는 **굵게** 만 통과시킨다. 꺾쇠가 그대로 나가면 안 된다.
  test('굵게 표시만 HTML 이 되고 나머지는 이스케이프된다', () => {
    const html = drylandHtml('free')
    expect(html).toContain('<strong>')
    expect(html).not.toContain('<script')
  })

  test('검색창과 결과 영역이 따로 있다 — 결과만 갈아 끼워야 커서가 산다', () => {
    const html = drylandHtml('free')
    expect(html).toContain('id="dryland-search"')
    expect(html).toContain('id="dryland-results"')
  })

  test('검색어가 비면 고른 영법의 세트가 나온다', () => {
    expect(drylandResultsHtml('breast', '')).toContain('평영')
  })

  test('검색하면 고른 영법 밖의 세트도 나오고 그 사실을 밝힌다', () => {
    const html = drylandResultsHtml('free', '밴드')
    expect(html).toContain('영법과 상관없이')
    expect(html).toContain('개를 찾았습니다')
  })

  test('없는 말을 치면 빈 결과 안내가 나온다', () => {
    expect(drylandResultsHtml('free', '역도')).toContain('찾는 동작이 없습니다')
  })

  test('검색어가 입력 칸에 다시 들어간다 — 다시 그려도 지워지면 안 된다', () => {
    expect(drylandHtml('free', '어깨')).toContain('value="어깨"')
  })
})

describe('수영용어 화면', () => {
  test('분류 제목과 용어가 나온다', () => {
    const html = termsHtml()
    expect(html).toContain('스트로크')
    expect(html).toContain('DPS')
    expect(html).toContain('플립턴')
  })

  test('퀴즈 시작 버튼이 있다', () => {
    expect(termsHtml()).toContain('id="quiz-start"')
  })

  test('검색창과 결과 영역이 따로 있다', () => {
    const html = termsHtml()
    expect(html).toContain('id="terms-search"')
    expect(html).toContain('id="terms-results"')
  })

  test('검색어가 비면 분류별 전체 목록으로 돌아간다', () => {
    const html = termsResultsHtml('')
    expect(html).toContain('class="term-group"')
    expect(html).toContain('벽 — 스타트와 턴')
  })

  test('검색하면 분류 묶음 없이 결과만 나온다 — 묶으면 맞은 순서가 깨진다', () => {
    const html = termsResultsHtml('플립턴')
    expect(html).toContain('플립턴')
    expect(html).not.toContain('class="term-group"')
  })

  test('없는 말을 치면 빈 결과 안내가 나온다', () => {
    expect(termsResultsHtml('싱크로나이즈드')).toContain('아직 용어집에 없습니다')
  })

  test('검색어가 입력 칸에 다시 들어간다', () => {
    expect(termsHtml('캐치')).toContain('value="캐치"')
  })

  // 검색어는 그대로 HTML 에 다시 들어간다. 이스케이프하지 않으면 구멍이 된다.
  test('검색어의 꺾쇠가 이스케이프된다', () => {
    const html = termsHtml('<script>alert(1)</script>')
    expect(html).not.toContain('<script>alert(1)')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('퀴즈 화면', () => {
  const question = buildQuiz(1, () => 0.5)[0]!

  test('문제와 보기 네 개가 나온다', () => {
    const html = quizQuestionHtml(question, 0, 10)
    expect(html).toContain('1 / 10')
    expect(html).toContain(escapeHtml(question.prompt))
    expect((html.match(/class="quiz-option"/g) ?? []).length).toBe(question.options.length)
  })

  test('맞히면 정답, 틀리면 답과 설명이 나온다', () => {
    const wrong = (question.answer + 1) % question.options.length
    expect(quizAnswerHtml(question, question.answer, false)).toContain('정답')
    const html = quizAnswerHtml(question, wrong, false)
    expect(html).toContain('오답')
    expect(html).toContain(escapeHtml(question.options[question.answer]!))
    expect(html).toContain(escapeHtml(question.explain))
  })

  test('마지막 문제에서는 다음 대신 결과 보기', () => {
    expect(quizAnswerHtml(question, 0, true)).toContain('결과 보기')
    expect(quizAnswerHtml(question, 0, false)).toContain('다음 문제')
  })

  test('결과에 점수와 총평과 다시 풀기가 있다', () => {
    const html = quizResultHtml(7, 10)
    expect(html).toContain('7 / 10')
    expect(html).toContain('id="quiz-again"')
    expect(html).toContain(escapeHtml(quizVerdict(7, 10)))
  })
})

describe('gradingHtml', () => {
  test('두 축을 모두 보여준다', () => {
    expect(gradingHtml(grading)).toContain('강도')
    expect(gradingHtml(grading)).toContain('분량')
  })

  test('불일치가 없으면 안내를 넣지 않는다', () => {
    expect(gradingHtml(grading)).not.toContain('mismatch')
  })

  test('불일치가 있으면 안내를 넣는다', () => {
    const mismatched = grade(parseTime('1:05.00')!, profile.goal.event, 'M', {
      sessionsPerWeek: 2,
      metersPerSession: 1500,
    })
    expect(gradingHtml(mismatched)).toContain('mismatch')
  })
})

describe('splitsHtml', () => {
  test('100m 는 네 구간이 나온다', () => {
    expect(splitsHtml(parseTime('1:22.00')!, 100).match(/<tr><td>/g)).toHaveLength(4)
  })

  test('25m 는 한 구간이다', () => {
    expect(splitsHtml(parseTime('15.00')!, 25).match(/<tr><td>/g)).toHaveLength(1)
  })
})

describe('recordsHtml', () => {
  const event = { stroke: 'free', distance: 100 } as const
  const entries: RecordEntry[] = [
    { date: '2026-03-01', event, timeCs: parseTime('1:31.00')! },
    { date: '2026-05-01', event, timeCs: parseTime('1:28.50')! },
    { date: '2026-07-01', event, timeCs: parseTime('1:27.10')! },
    // 다른 종목은 이 화면에 섞이면 안 된다.
    { date: '2026-06-01', event: { stroke: 'breast', distance: 50 }, timeCs: 4500 },
  ]

  const html = recordsHtml(entries, event, 'M')

  test('선택한 종목만 표에 들어간다', () => {
    expect(html.match(/<tr>\s*<td>/g)).toHaveLength(3)
  })

  test('최고기록을 요약으로 띄운다', () => expect(html).toContain('1:27.10'))
  test('점이 두 개 이상이면 차트를 그린다', () => expect(html).toContain('<svg'))

  test('기록이 줄어든 행을 표시한다', () => expect(html).toContain('better'))

  test('위치 숫자가 백분위가 아님을 밝힌다', () => {
    expect(html).toContain('백분위가 아닙니다')
  })

  test('기록이 하나뿐이면 차트 대신 안내가 나온다', () => {
    const single = recordsHtml([entries[0]!], event, 'M')
    expect(single).not.toContain('<svg')
    expect(single).toContain('두 개 이상')
  })

  test('기록이 없으면 추가하라고 안내한다', () => {
    expect(recordsHtml([], event, 'M')).toContain('아직 없습니다')
  })
})
