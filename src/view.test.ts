import { describe, expect, test } from 'bun:test'
import { grade } from './grading'
import { parseTime } from './pace'
import { weekDays, weeklyPlan } from './plan'
import type { Body, Profile, RecordEntry } from './types'
import {
  dayHtml,
  escapeHtml,
  gradingHtml,
  HOME_HTML,
  NEEDS_BODY_HTML,
  recordsHtml,
  SPLASH_HTML,
  splitsHtml,
  trainingHtml,
} from './view'

const body: Body = { heightCm: 172, weightKg: 68 }

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
})

describe('훈련 로그', () => {
  const trainingDay = days.find((day) => day.session !== null)!

  test('훈련일에 완주 개수를 받는 칸이 나온다', () => {
    const html = dayHtml(profile, trainingDay, 7, [], '2026-07-26')
    expect(html).toContain('id="log-reps"')
    expect(html).toContain('완주 기록')
  })

  test('휴식일에는 완주 칸이 없다', () => {
    const restDay = days.find((day) => day.session === null)!
    expect(dayHtml(profile, restDay, 7, [], '2026-07-26')).not.toContain('log-reps')
  })

  test('계획 개수가 세트 지시문과 일치한다', () => {
    const html = dayHtml(profile, trainingDay, 7, [], '2026-07-26')
    // 100m 목표 · 강도/분량 중급이면 주 세트는 레이스페이스 50 8회다
    expect(html).toContain('data-planned="8"')
    expect(html).toContain('계획 8개 중')
  })

  test('기록이 없으면 판정을 보류한다', () => {
    expect(dayHtml(profile, trainingDay, 7, [], '2026-07-26')).toContain('남기면 목표가 적절한지')
  })

  test('세 번 연속 못 채우면 목표가 이르다고 알린다', () => {
    const logs = ['2026-07-10', '2026-07-15', '2026-07-20'].map((date) => ({
      date,
      methodId: 'rp50',
      plannedReps: 8,
      completedReps: 3,
    }))
    const html = dayHtml(profile, trainingDay, 7, logs, '2026-07-26')
    expect(html).toContain('too-hard')
    expect(html).toContain('이릅니다')
  })

  test('오늘 이미 남긴 값은 되불러 수정할 수 있다', () => {
    const logs = [{ date: '2026-07-26', methodId: 'rp50', plannedReps: 8, completedReps: 6 }]
    const html = dayHtml(profile, trainingDay, 7, logs, '2026-07-26')
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
