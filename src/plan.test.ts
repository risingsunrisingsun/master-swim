import { describe, expect, test } from 'bun:test'
import { grade } from './grading'
import { parseTime } from './pace'
import { weekDays, weeklyMeters, weeklyPlan, type Purpose } from './plan'
import type { Distance, Profile, Stroke } from './types'

const at = (time: string): number => parseTime(time)!

function profileFor(
  overrides: {
    stroke?: Stroke
    distance?: Distance
    target?: string
    current?: string
    sessions?: number
    meters?: number
  } = {},
): Profile {
  return {
    ageGroup: '45-49',
    sex: 'M',
    goal: {
      event: { stroke: overrides.stroke ?? 'free', distance: overrides.distance ?? 100 },
      targetCs: at(overrides.target ?? '1:22.00'),
      currentCs: at(overrides.current ?? '1:28.00'),
    },
    load: {
      sessionsPerWeek: overrides.sessions ?? 3,
      metersPerSession: overrides.meters ?? 2000,
    },
  }
}

const planFor = (overrides: Parameters<typeof profileFor>[0] = {}) => {
  const profile = profileFor(overrides)
  const grading = grade(profile.goal.currentCs, profile.goal.event, profile.sex, profile.load)
  return weeklyPlan(profile, grading)
}

describe('세션 수', () => {
  test('주간 횟수만큼 세션이 나온다', () => {
    expect(planFor({ sessions: 3 })).toHaveLength(3)
    expect(planFor({ sessions: 5 })).toHaveLength(5)
  })

  test('우선순위 목록보다 많으면 앞에서부터 다시 돌아 레이스 페이스가 두 번 들어간다', () => {
    const focuses = planFor({ sessions: 6, meters: 3000 }).map((session) => session.focus)
    expect(focuses.filter((focus) => focus === 'racePace')).toHaveLength(2)
  })

  test('0회나 8회처럼 범위를 벗어난 값도 계획을 만든다', () => {
    expect(planFor({ sessions: 0 })).toHaveLength(1)
    expect(planFor({ sessions: 20, meters: 3000 })).toHaveLength(7)
  })
})

describe('레이스 페이스 세션은 항상 첫 자리다', () => {
  for (const distance of [25, 50, 100] as Distance[]) {
    test(`${distance}m 목표`, () => {
      expect(planFor({ distance, target: '30.00' })[0]!.focus).toBe('racePace')
    })
  }
})

describe('목표 거리가 배치를 가른다', () => {
  test('25m 는 벽 구간이 최대 속도보다 앞선다', () => {
    const focuses = planFor({ distance: 25, target: '15.00', current: '16.50' }).map((s) => s.focus)
    expect(focuses.indexOf('wall')).toBeLessThan(focuses.indexOf('speed'))
  })

  test('100m 는 지속력이 최대 속도를 밀어낸다', () => {
    const focuses = planFor({ distance: 100, sessions: 3 }).map((s) => s.focus)
    expect(focuses).toContain('wall')
    expect(focuses).not.toContain('speed')
  })

  test('100m 는 레이스 페이스 50 을, 25m 는 레이스 페이스 25 를 쓴다', () => {
    const long = planFor({ distance: 100 })[0]!.items.find((item) => item.role === 'main')
    const short = planFor({ distance: 25, target: '15.00', current: '16.50' })[0]!.items.find(
      (item) => item.role === 'main',
    )
    expect(long!.method.id).toBe('rp50')
    expect(short!.method.id).toBe('rp25')
  })
})

describe('두 축이 갈라져 쓰인다', () => {
  test('분량 등급이 반복 수를, 강도 등급이 인터벌을 정한다', () => {
    // 기록은 최상급(1:05)인데 주 2회만 나오는 회원 → 강도 최상급 · 분량 초급
    const profile = profileFor({ current: '1:05.00', sessions: 2, meters: 1500 })
    const grading = grade(profile.goal.currentCs, profile.goal.event, profile.sex, profile.load)
    expect(grading.intensity).toBe('elite')
    expect(grading.volume).toBe('beginner')

    const main = weeklyPlan(profile, grading)[0]!.items.find((item) => item.role === 'main')!
    // 초급 분량 6회 × 최상급 인터벌(휴식 15초)
    expect(main.text).toContain('6 × 50m')
    expect(main.text).toContain('인터벌 56.35')
  })
})

describe('육상', () => {
  test('가동성은 세션 앞, 나머지는 세션 뒤에 붙는다', () => {
    const items = planFor()[0]!.items
    expect(items[0]!.method.id).toBe('mobility')
    expect(items.at(-1)!.role).toBe('after')
  })

  test('하체 파워는 수영 앞에 오지 않는다', () => {
    for (const session of planFor({ sessions: 5, meters: 3000 })) {
      const lower = session.items.find((item) => item.method.id === 'lower-power')
      if (lower) expect(lower.role).toBe('after')
    }
  })
})

describe('안전 규칙이 배치까지 이어진다', () => {
  test('강도 초급이면 젖산 내성 대신 킥이 들어간다', () => {
    const ids = planFor({ current: '2:00.00', sessions: 5, meters: 3000 }).flatMap((session) =>
      session.items.map((item) => item.method.id),
    )
    expect(ids).not.toContain('lactate-tolerance')
    expect(ids).toContain('kick')
  })

  test('강도 고급이면 젖산 내성이 들어간다', () => {
    const ids = planFor({ current: '1:15.00', sessions: 5, meters: 3000 }).flatMap((session) =>
      session.items.map((item) => item.method.id),
    )
    expect(ids).toContain('lactate-tolerance')
  })
})

describe('weekDays · 한 주 7일에 흩기', () => {
  test('항상 7일을 돌려준다', () => {
    expect(weekDays(planFor({ sessions: 3 }))).toHaveLength(7)
  })

  test('세션 수만큼만 훈련일이 된다', () => {
    const days = weekDays(planFor({ sessions: 3 }))
    expect(days.filter((day) => day.session !== null)).toHaveLength(3)
  })

  test('주 3회는 몰리지 않는다 — 훈련일 사이에 하루 이상 쉰다', () => {
    const trainingDays = weekDays(planFor({ sessions: 3 }))
      .filter((day) => day.session !== null)
      .map((day) => day.index)

    for (let i = 1; i < trainingDays.length; i++) {
      expect(trainingDays[i]! - trainingDays[i - 1]!).toBeGreaterThan(1)
    }
  })

  test('주 7회면 쉬는 날이 없다', () => {
    const days = weekDays(planFor({ sessions: 7, meters: 3000 }))
    expect(days.every((day) => day.session !== null)).toBe(true)
  })

  test('요일 라벨이 월요일부터 붙는다', () => {
    expect(weekDays(planFor()).map((day) => day.label)).toEqual([
      '월', '화', '수', '목', '금', '토', '일',
    ])
  })
})

describe('거리 합계', () => {
  test('세션마다 수영 거리가 계산된다', () => {
    for (const session of planFor()) expect(session.meters).toBeGreaterThan(0)
  })

  test('주간 합계는 세션 합의 총합이다', () => {
    const plan = planFor()
    expect(weeklyMeters(plan)).toBe(plan.reduce((sum, session) => sum + session.meters, 0))
  })
})

describe('목적', () => {
  const gradingFor = (p: Profile) => grade(p.goal.currentCs, p.goal.event, p.sex, p.load)
  const focuses = (p: Profile, purpose?: Purpose) =>
    weeklyPlan(p, gradingFor(p), purpose).map((session) => session.focus)

  // 목적을 고르지 않던 때와 같은 플랜이 나와야 한다.
  test('기본값은 기록 단축이고 목적을 안 넘긴 것과 같다', () => {
    const p = profileFor({ sessions: 5 })
    expect(focuses(p)).toEqual(focuses(p, 'faster'))
  })

  test('고른 목적이 첫 세션으로 온다', () => {
    const p = profileFor({ sessions: 3 })
    expect(focuses(p, 'form')[0]).toBe('technique')
    expect(focuses(p, 'breathing')[0]).toBe('breathing')
    expect(focuses(p, 'faster')[0]).toBe('racePace')
  })

  // 한 가지만 파면 나머지가 무너진다. 주 5회면 다섯 성격이 다 들어와야 한다.
  test('주 5회면 어느 목적이든 다섯 성격이 모두 들어간다', () => {
    const p = profileFor({ sessions: 5 })
    for (const purpose of ['faster', 'form', 'breathing', 'injury'] as Purpose[]) {
      expect(new Set(focuses(p, purpose)).size).toBe(5)
    }
  })

  // 부상 예방은 강도를 맨 뒤로 밀어 적게 나오는 회원에게 배정되지 않게 한다.
  test('부상 예방은 주 3회까지 최대 속도를 넣지 않는다', () => {
    const p = profileFor({ sessions: 3 })
    expect(focuses(p, 'injury')).not.toContain('speed')
  })

  test('호흡 세션은 호흡 방법으로 채워진다', () => {
    const p = profileFor({ sessions: 3 })
    const session = weeklyPlan(p, gradingFor(p), 'breathing')[0]!
    const pool = session.items.filter((item) => item.method.kind === 'pool')
    expect(pool.length).toBeGreaterThan(0)
    for (const item of pool) expect(item.method.category).toBe('breathing')
  })

  // 100m 는 후반에 숨이 무너지므로 배분이, 50m 는 배분할 구간이 짧아 좌우 균형이 먼저다.
  test('호흡 세션의 주역이 거리에 따라 갈린다', () => {
    const long = profileFor({ distance: 100, sessions: 3 })
    const short = profileFor({ distance: 50, sessions: 3 })
    const mainOf = (p: Profile) =>
      weeklyPlan(p, gradingFor(p), 'breathing')[0]!.items.find((i) => i.role === 'main')!.method.id
    expect(mainOf(long)).toBe('breath-plan')
    expect(mainOf(short)).toBe('bilateral')
  })
})
