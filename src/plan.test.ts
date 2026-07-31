import { describe, expect, test } from 'bun:test'
import { grade } from './grading'
import { parseTime } from './pace'
import { weekDays, weeklyMeters, weeklyPlan } from './plan'
import type { Distance, Profile, Purpose, SessionFormat, Stroke } from './types'

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

  // 성격이 여섯이라 주 6회까지는 겹치지 않는다. 되도는 것은 7회부터다.
  test('주 6회면 여섯 성격이 한 번씩 들어간다', () => {
    const focuses = planFor({ sessions: 6, meters: 3000 }).map((session) => session.focus)
    expect(new Set(focuses).size).toBe(6)
  })

  test('우선순위 목록보다 많으면 앞에서부터 다시 돌아 레이스 페이스가 두 번 들어간다', () => {
    const focuses = planFor({ sessions: 7, meters: 3000 }).map((session) => session.focus)
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

describe('목적과 형식', () => {
  const gradingFor = (p: Profile) => grade(p.goal.currentCs, p.goal.event, p.sex, p.load)
  const planWith = (p: Profile, purpose?: Purpose, format?: SessionFormat) => {
    const withChoice = { ...p, purpose, format }
    return weeklyPlan(withChoice, gradingFor(withChoice))
  }
  const focuses = (p: Profile, purpose?: Purpose) =>
    planWith(p, purpose).map((session) => session.focus)

  // 목적을 고르지 않던 때와 같은 플랜이 나와야 한다.
  test('고르지 않으면 기록 단축과 같다', () => {
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

  // 개수만 세면 **어떤** 다섯인지를 놓친다. 실제로 호흡 목적이 최대 속도를 배열에서
  // 통째로 빼고도 다섯을 채워 이 테스트를 통과한 적이 있다. 전 종목이 스프린트인
  // 앱에서 한 주기 내내 전력이 없으면 목표 페이스의 천장이 그대로다.
  test('주 5회면 어느 목적이든 최대 속도가 들어간다', () => {
    const p = profileFor({ sessions: 5 })
    for (const purpose of ['faster', 'form', 'breathing', 'injury'] as Purpose[]) {
      expect(focuses(p, purpose)).toContain('speed')
    }
  })

  // 부상 예방은 강도를 맨 뒤로 밀어 적게 나오는 회원에게 배정되지 않게 한다.
  test('부상 예방은 주 3회까지 최대 속도를 넣지 않는다', () => {
    const p = profileFor({ sessions: 3 })
    expect(focuses(p, 'injury')).not.toContain('speed')
  })

  test('호흡 세션은 호흡 방법으로 채워진다', () => {
    const session = planWith(profileFor({ sessions: 3 }), 'breathing')[0]!
    // 이지 스윔 채우기(회복 스윔)는 성격과 무관하게 붙는 자리라 빼고 본다.
    const pool = session.items.filter(
      (item) => item.method.kind === 'pool' && item.method.id !== 'recovery',
    )
    expect(pool.length).toBeGreaterThan(0)
    for (const item of pool) expect(item.method.category).toBe('breathing')
  })

  // 100m 는 후반에 숨이 무너지므로 배분이, 50m 는 배분할 구간이 짧아 좌우 균형이 먼저다.
  test('호흡 세션의 주역이 거리에 따라 갈린다', () => {
    const mainOf = (distance: Distance) =>
      planWith(profileFor({ distance, sessions: 3 }), 'breathing')[0]!.items.find(
        (i) => i.role === 'main',
      )!.method.id
    expect(mainOf(100)).toBe('breath-plan')
    expect(mainOf(50)).toBe('bilateral')
  })

  test('밴드를 고르면 밴드로 하는 지상훈련이 붙는다', () => {
    for (const session of planWith(profileFor({ sessions: 5 }), 'faster', 'band')) {
      expect(session.items.find((item) => item.role === 'after')!.method.id).toBe('rotator-cuff')
    }
  })

  // 지상훈련이 수영 뒤에 오는 것은 취향이 아니라 훈련 순서다.
  test('형식을 바꿔도 지상훈련은 수영 뒤에 남는다', () => {
    for (const format of ['pool', 'dryland', 'band'] as SessionFormat[]) {
      for (const session of planWith(profileFor({ sessions: 3 }), 'faster', format)) {
        const roles = session.items.map((item) => item.role)
        expect(roles.lastIndexOf('after')).toBe(roles.length - 1)
        expect(roles.indexOf('warmup')).toBe(0)
      }
    }
  })
})

// 성격마다 질 위주 세트의 거리가 7배 벌어져 있어, 그대로 두면 목적이 순서를 바꿀 때
// 무엇이 잘리느냐로 주간 총량이 배 넘게 흔들렸다. 모자란 만큼은 쉬운 헤엄으로 채운다.
describe('이지 스윔 채우기', () => {
  const gradingFor = (p: Profile) => grade(p.goal.currentCs, p.goal.event, p.sex, p.load)
  const planWith = (p: Profile, purpose?: Purpose) => {
    const withChoice = { ...p, purpose }
    return weeklyPlan(withChoice, gradingFor(withChoice))
  }
  const fillerOf = (session: { items: { method: { id: string }; note?: string }[] }) =>
    session.items.find((item) => item.method.id === 'recovery' && item.note?.includes('채우는 자리'))

  test('짧은 세션은 적어 준 거리 가까이까지 채워진다', () => {
    for (const session of planFor({ sessions: 5, meters: 2000 })) {
      expect(session.meters).toBeGreaterThan(1500)
      expect(session.meters).toBeLessThanOrEqual(2000)
    }
  })

  test('목적을 바꿔도 주간 거리가 크게 흔들리지 않는다', () => {
    const totals = (['faster', 'form', 'injury', 'breathing'] as Purpose[]).map((purpose) =>
      weeklyMeters(planWith(profileFor({ sessions: 3, meters: 2000 }), purpose)),
    )
    // 고치기 전에는 주 3회에서 최대 2.3배까지 벌어졌다.
    expect(Math.max(...totals) / Math.min(...totals)).toBeLessThan(1.2)
  })

  // 반복 수는 분량 등급이 정하고, 그 등급을 만드는 재료가 '세션당 거리'다.
  // 같은 값으로 반복 수를 다시 곱하면 등급이 눌러 둔 상한을 등급의 재료가 뚫는다.
  test('채우기는 질 위주 세트의 반복 수를 늘리지 않는다', () => {
    const profile = profileFor({ current: '1:05.00', sessions: 2, meters: 1500 })
    const grading = grade(profile.goal.currentCs, profile.goal.event, profile.sex, profile.load)
    expect(grading.intensity).toBe('elite')
    expect(grading.volume).toBe('beginner')

    const main = weeklyPlan(profile, grading)[0]!.items.find((item) => item.role === 'main')!
    expect(main.text).toContain('6 × 50m')
  })

  test('채우기는 쉬운 헤엄이고 페이스를 재지 않는다고 밝힌다', () => {
    const filler = fillerOf(planFor({ sessions: 5, meters: 2000 })[2]!)
    expect(filler).toBeDefined()
    expect(filler!.method.id).toBe('recovery')
  })

  // 이미 회복 스윔이 든 세션에 또 붙이면 같은 세트가 두 번 나온다. 늘리기만 한다.
  test('지속력 세션은 회복 스윔이 하나로 남고 늘어난다', () => {
    const endurance = planFor({ sessions: 5, meters: 2000 }).find(
      (session) => session.focus === 'endurance',
    )!
    const recoveries = endurance.items.filter((item) => item.method.id === 'recovery')
    expect(recoveries).toHaveLength(1)
    expect(recoveries[0]!.note).toContain('채우는 자리')
    expect(endurance.meters).toBeGreaterThan(1500)
  })

  test('적어 준 거리를 이미 넘긴 세션은 채우지 않는다', () => {
    // 100m 목표의 레이스 페이스 세션은 질 위주 세트만으로 500m 를 넘는다.
    const racePace = planFor({ sessions: 5, meters: 500 }).find(
      (session) => session.focus === 'racePace',
    )!
    expect(fillerOf(racePace)).toBeUndefined()
  })
})
