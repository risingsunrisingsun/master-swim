import { describe, expect, test } from 'bun:test'
import { grade } from './grading'
import { parseTime } from './pace'
import { weeklyPlan } from './plan'
import type { Profile } from './types'
import { escapeHtml, gradingHtml, resultHtml, sessionHtml, splitsHtml } from './view'

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

describe('escapeHtml', () => {
  test('꺾쇠와 앰퍼샌드를 막는다', () => {
    expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;')
  })
})

describe('resultHtml', () => {
  const html = resultHtml(profile, grading, plan)

  test('목표 페이스가 들어간다', () => expect(html).toContain('20.68'))
  test('단축 폭이 들어간다', () => expect(html).toContain('6.8%'))
  test('세션 수만큼 카드가 생긴다', () => {
    expect(html.match(/class="session"/g)).toHaveLength(3)
  })
  test('구간 목표 표가 들어간다', () => expect(html).toContain('대회 구간 목표'))
  test('계획 거리와 입력 거리를 나란히 보여준다', () => {
    expect(html).toContain('입력 6,000m')
  })
  test('닫히지 않은 태그가 없다', () => {
    const opens = (html.match(/<(article|ul|li|table|tbody|thead|tr|div|span|strong|p|h2|h3)\b/g) ?? [])
      .length
    const closes = (html.match(/<\/(article|ul|li|table|tbody|thead|tr|div|span|strong|p|h2|h3)>/g) ?? [])
      .length
    expect(opens).toBe(closes)
  })
})

describe('sessionHtml', () => {
  test('일차 번호는 1부터 센다', () => {
    expect(sessionHtml(plan[0]!, 0)).toContain('1일차')
  })

  test('세션의 모든 항목이 렌더링된다', () => {
    const html = sessionHtml(plan[0]!, 0)
    expect(html.match(/<li>/g)).toHaveLength(plan[0]!.items.length)
  })

  test('역할 라벨이 한글로 나온다', () => {
    const html = sessionHtml(plan[0]!, 0)
    expect(html).toContain('주 세트')
    expect(html).toContain('준비')
  })
})

describe('gradingHtml', () => {
  test('두 축을 모두 보여준다', () => {
    const html = gradingHtml(grading)
    expect(html).toContain('강도')
    expect(html).toContain('분량')
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
