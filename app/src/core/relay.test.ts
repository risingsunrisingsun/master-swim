import { describe, expect, test } from 'bun:test'
import {
  bestRelayTeams,
  DEFAULT_TAKEOVER_CS,
  MEDLEY_ORDER,
  type RelayOptions,
  type RelaySwimmer,
  relayBests,
} from './relay'
import type { SwimRecord } from './types'

const base: RelayOptions = {
  kind: 'medley',
  gender: 'M',
  ageMin: null,
  ageMax: null,
  year: 2026,
  takeoverCs: 0,
  teams: 1,
}

function swimmer(id: string, bests: RelaySwimmer['bests'], extra: Partial<RelaySwimmer> = {}): RelaySwimmer {
  return { memberId: id, name: `회원${id}`, sex: 'M', birthYear: 1980, bests, ...extra }
}

const ids = (team: { legs: { swimmer: RelaySwimmer }[] }) => team.legs.map((leg) => leg.swimmer.memberId)

describe('혼계영', () => {
  test('영법별로 따로 가장 빠른 사람을 뽑지 않고 합이 가장 작은 배정을 고른다', () => {
    // a 는 자유형 · 접영 모두 가장 빠르다. a 를 접영에 두고 b 를 자유형에 두는 편이 합이 작다.
    const pool = [
      swimmer('a', { free: 2800, fly: 3000 }),
      swimmer('b', { free: 2900, fly: 3600 }),
      swimmer('c', { back: 3500 }),
      swimmer('d', { breast: 3900 }),
    ]
    const { teams } = bestRelayTeams(pool, base)
    expect(teams).toHaveLength(1)
    const team = teams[0]!
    expect(team.legs.map((leg) => leg.stroke)).toEqual([...MEDLEY_ORDER])
    expect(ids(team)).toEqual(['c', 'd', 'a', 'b'])
    expect(team.rawCs).toBe(3500 + 3900 + 3000 + 2900)
  })

  test('한 영법을 할 수 있는 사람이 없으면 팀이 없다', () => {
    const pool = [swimmer('a', { free: 2800 }), swimmer('b', { back: 3500 }), swimmer('c', { fly: 3100 }), swimmer('d', { free: 3000 })]
    expect(bestRelayTeams(pool, base).teams).toEqual([])
  })

  test('50m 기록이 하나도 없는 사람은 까닭과 함께 빠진다', () => {
    const result = bestRelayTeams([swimmer('a', {}), swimmer('b', { free: 3000 })], base)
    expect(result.excluded).toEqual([{ name: '회원a', reason: '50m 기록 없음' }])
    expect(result.candidates).toBe(1)
  })
})

describe('계영', () => {
  const free = { ...base, kind: 'free' as const }

  test('가장 빠른 네 명을 고르고 앵커는 가장 빠른 사람, 첫 영자는 두 번째', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'].map((id, i) => swimmer(id, { free: 2800 + i * 100 }))
    const team = bestRelayTeams(pool, free).teams[0]!
    expect(ids(team)).toEqual(['b', 'd', 'c', 'a'])
    expect(team.rawCs).toBe(2800 + 2900 + 3000 + 3100)
  })

  test('인계 보정은 2~4번 영자 세 명 몫을 뺀다', () => {
    const pool = ['a', 'b', 'c', 'd'].map((id) => swimmer(id, { free: 3000 }))
    const team = bestRelayTeams(pool, { ...free, takeoverCs: DEFAULT_TAKEOVER_CS }).teams[0]!
    expect(team.rawCs).toBe(12000)
    expect(team.totalCs).toBe(12000 - 3 * DEFAULT_TAKEOVER_CS)
  })

  test('자유형 50m 기록이 없으면 빠진다', () => {
    const result = bestRelayTeams([swimmer('a', { back: 3500 })], free)
    expect(result.excluded).toEqual([{ name: '회원a', reason: '자유형 50m 기록 없음' }])
  })
})

describe('성별', () => {
  const free = { ...base, kind: 'free' as const }

  test('혼성은 남자 둘 · 여자 둘이어야 한다', () => {
    const pool = [
      swimmer('m1', { free: 2600 }),
      swimmer('m2', { free: 2700 }),
      swimmer('m3', { free: 2750 }),
      swimmer('f1', { free: 3100 }, { sex: 'F' }),
      swimmer('f2', { free: 3200 }, { sex: 'F' }),
      swimmer('f3', { free: 3300 }, { sex: 'F' }),
    ]
    const team = bestRelayTeams(pool, { ...free, gender: 'X' }).teams[0]!
    expect(ids(team).sort()).toEqual(['f1', 'f2', 'm1', 'm2'])
  })

  test('남자 계영에 여자 회원은 후보도 빠진 사람도 아니다', () => {
    const result = bestRelayTeams([swimmer('f', { free: 3000 }, { sex: 'F' })], free)
    expect(result.excluded).toEqual([])
    expect(result.candidates).toBe(0)
  })

  test('성별을 모르면 빠진다', () => {
    const result = bestRelayTeams([swimmer('a', { free: 3000 }, { sex: null })], { ...free, gender: 'X' })
    expect(result.excluded).toEqual([{ name: '회원a', reason: '성별 미입력' }])
  })
})

describe('연령 합', () => {
  const free = { ...base, kind: 'free' as const }

  test('구간 안의 조합만 고른다', () => {
    // 2026년 기준 나이 20 · 30 · 40 · 50 · 60
    const pool = [20, 30, 40, 50, 60].map((age, i) => swimmer(`s${age}`, { free: 2800 + i * 100 }, { birthYear: 2026 - age }))
    const team = bestRelayTeams(pool, { ...free, ageMin: 175, ageMax: 199 }).teams[0]!
    // 가장 빠른 넷(20+30+40+50=140)은 구간 밖. 175 를 넘는 조합은 20 을 빼고 60 을 넣은 180 하나.
    expect(team.ageSum).toBe(180)
    expect(ids(team).sort()).toEqual(['s30', 's40', 's50', 's60'])
  })

  test('구간이 있으면 출생연도 없는 사람은 빠지고, 구간이 없으면 합이 null', () => {
    const pool = ['a', 'b', 'c', 'd'].map((id) => swimmer(id, { free: 3000 }, { birthYear: id === 'a' ? null : 1980 }))
    const limited = bestRelayTeams(pool, { ...free, ageMin: 100, ageMax: null })
    expect(limited.excluded).toEqual([{ name: '회원a', reason: '출생연도 미입력' }])
    expect(limited.teams).toEqual([])
    expect(bestRelayTeams(pool, free).teams[0]!.ageSum).toBeNull()
  })
})

describe('여러 팀', () => {
  test('A팀 네 명을 빼고 B팀을 뽑는다', () => {
    const pool = Array.from({ length: 9 }, (_, i) => swimmer(`s${i}`, { free: 2800 + i * 50 }))
    const { teams } = bestRelayTeams(pool, { ...base, kind: 'free', teams: 3 })
    expect(teams).toHaveLength(2) // 9명이라 세 번째 팀은 못 만든다
    expect(ids(teams[0]!).sort()).toEqual(['s0', 's1', 's2', 's3'])
    expect(ids(teams[1]!).sort()).toEqual(['s4', 's5', 's6', 's7'])
  })
})

describe('성능', () => {
  test('30명 혼성 혼계영도 금방 끝난다', () => {
    const pool = Array.from({ length: 30 }, (_, i) =>
      swimmer(
        `s${String(i).padStart(2, '0')}`,
        { free: 2800 + ((i * 37) % 600), back: 3300 + ((i * 53) % 700), breast: 3700 + ((i * 29) % 800), fly: 3000 + ((i * 41) % 700) },
        { sex: i % 2 ? 'F' : 'M', birthYear: 1960 + (i % 30) },
      ),
    )
    const started = performance.now()
    const result = bestRelayTeams(pool, { ...base, gender: 'X', ageMin: 160, ageMax: 199, teams: 3 })
    expect(performance.now() - started).toBeLessThan(1000)
    expect(result.teams).toHaveLength(3)
    for (const team of result.teams) {
      expect(team.legs.filter((leg) => leg.swimmer.sex === 'M')).toHaveLength(2)
      expect(team.ageSum).toBeGreaterThanOrEqual(160)
      expect(team.ageSum).toBeLessThanOrEqual(199)
    }
  })
})

describe('relayBests', () => {
  const record = (stroke: SwimRecord['stroke'], distance: SwimRecord['distance'], timeCs: number, date: string, memberId = 'm'): SwimRecord => ({
    id: `${stroke}-${distance}-${timeCs}`,
    memberId,
    stroke,
    distance,
    timeCs,
    date,
    source: 'self',
    meetingId: null,
    note: '',
  })

  test('50m 만, 기준일 이후만, 영법별 가장 빠른 것', () => {
    const records = [
      record('free', 50, 3000, '2026-01-01'),
      record('free', 50, 2900, '2025-01-01'), // 기준일 전
      record('free', 25, 1300, '2026-02-01'),
      record('free', 100, 6500, '2026-02-01'),
      record('back', 50, 3600, '2026-03-01'),
      record('back', 50, 3500, '2026-04-01'),
      record('im', 100, 7500, '2026-04-01'),
      record('fly', 50, 3100, '2026-04-01', 'other'),
    ]
    expect(relayBests(records, 'm', '2025-11-19')).toEqual({ free: 3000, back: 3500 })
    expect(relayBests(records, 'm', null)).toEqual({ free: 2900, back: 3500 })
  })
})
