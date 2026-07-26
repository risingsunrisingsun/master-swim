import { describe, expect, test } from 'bun:test'
import {
  type Decade,
  decadeOf,
  DISTRIBUTIONS,
  findDistribution,
  percentileBeaten,
  timeForTopPercent,
} from './distributions'
import { parseTime } from './pace'
import type { Sex, Stroke } from './types'

const at = (time: string): number => parseTime(time)!
const M20_FREE = findDistribution('free', 50, 'M', 20)!

describe('데이터 무결성', () => {
  test('중복된 (영법·거리·성별·연대) 조합이 없다', () => {
    const keys = DISTRIBUTIONS.map((d) => `${d.stroke}/${d.distance}/${d.sex}/${d.decade}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('모든 분포에 구간이 있고 음수가 없다', () => {
    for (const dist of DISTRIBUTIONS) {
      expect(dist.counts.length).toBeGreaterThan(5)
      expect(dist.counts.every((count) => count >= 0)).toBe(true)
      expect(dist.total).toBeGreaterThan(0)
    }
  })

  test('읽어 넣은 합이 표시된 표본 수와 크게 어긋나지 않는다', () => {
    // 그래프에서 눈으로 읽은 값이므로 정확히 같을 수 없다. 30% 안이면 모양은 믿을 만하다.
    for (const dist of DISTRIBUTIONS) {
      const sum = dist.counts.reduce((a, b) => a + b, 0)
      const drift = Math.abs(sum - dist.total) / dist.total
      expect(drift).toBeLessThan(0.3)
    }
  })
})

describe('decadeOf', () => {
  test('5세 연령부를 연대로 접는다', () => {
    expect(decadeOf('25-29')).toBe(20)
    expect(decadeOf('30-34')).toBe(30)
    expect(decadeOf('35-39')).toBe(30)
    expect(decadeOf('45-49')).toBe(40)
    expect(decadeOf('55-59')).toBe(50)
    expect(decadeOf('60-64')).toBe(60)
  })

  test('70대 이상은 60대 분포를 쓴다 — 그 위 데이터가 없다', () => {
    expect(decadeOf('70+')).toBe(60)
  })
})

describe('percentileBeaten · 방향이 뒤집히면 안 되는 값', () => {
  test('빠를수록 많이 이긴다', () => {
    expect(percentileBeaten(at('26.00'), M20_FREE)).toBeGreaterThan(
      percentileBeaten(at('40.00'), M20_FREE),
    )
  })

  test('분포 범위를 벗어나면 0 또는 100 으로 잘린다', () => {
    expect(percentileBeaten(at('15.00'), M20_FREE)).toBe(100)
    expect(percentileBeaten(at('5:00.00'), M20_FREE)).toBe(0)
  })

  test('중앙값 근처에서 50 에 가깝다', () => {
    const median = timeForTopPercent(50, M20_FREE)
    expect(percentileBeaten(median, M20_FREE)).toBeCloseTo(50, 0)
  })
})

describe('timeForTopPercent', () => {
  test('상위 %가 커질수록 커트라인이 느려진다', () => {
    const cuts = [5, 10, 25, 50, 75, 90].map((p) => timeForTopPercent(p, M20_FREE))
    for (let i = 1; i < cuts.length; i++) expect(cuts[i]!).toBeGreaterThan(cuts[i - 1]!)
  })

  test('percentileBeaten 과 왕복한다', () => {
    for (const top of [10, 25, 50, 75]) {
      const cut = timeForTopPercent(top, M20_FREE)
      expect(percentileBeaten(cut, M20_FREE)).toBeCloseTo(100 - top, 0)
    }
  })
})

const STROKES = ['free', 'back', 'breast', 'fly'] as const
const SEXES = ['M', 'F'] as const
const DECADES = [20, 30, 40, 50, 60] as const

const median = (stroke: Stroke, sex: Sex, decade: Decade): number =>
  timeForTopPercent(50, findDistribution(stroke, 50, sex, decade)!)

describe('분포가 상식과 맞는가', () => {
  test('20 → 30 → 40대는 중앙값이 순서대로 느려지고, 60대가 40대보다 느리다', () => {
    for (const stroke of STROKES) {
      for (const sex of SEXES) {
        const young = ([20, 30, 40] as const).map((decade) => median(stroke, sex, decade))
        for (let i = 1; i < young.length; i++) expect(young[i]!).toBeGreaterThan(young[i - 1]!)
        expect(median(stroke, sex, 60)).toBeGreaterThan(median(stroke, sex, 40))
      }
    }
  })

  // 50대는 40대와 비교하지 않는다. `F/50/free` 는 중앙값이 40대보다 **빠르게** 나온다 —
  // 50대 이상 현상이 이 한 분포에서는 꼬리를 넘어 중앙값까지 닿는다(`distributions.ts`
  // 머리말). 30대보다 느리다는 것까지는 여덟 분포 전부에서 성립하므로 그것만 고정한다.
  test('50대 중앙값은 적어도 30대보다 느리다', () => {
    for (const stroke of STROKES) {
      for (const sex of SEXES) {
        expect(median(stroke, sex, 50)).toBeGreaterThan(median(stroke, sex, 30))
      }
    }
  })

  // 자유형 < 접영 < 배영 순서는 모든 연대·성별에서 성립한다. 평영은 자유형·접영보다는
  // 확실히 느리지만 **배영과는 고정하지 않는다** — 남자 30·40대에서 두 중앙값이 0.4초
  // 안으로 붙고 순서가 뒤집힌다. 실제로 붙어 있는 값을 테스트로 못박지 않는다.
  test('같은 연대에서 자유형 < 접영 < 배영 이고, 평영은 접영보다 느리다', () => {
    for (const sex of SEXES) {
      for (const decade of DECADES) {
        const free = median('free', sex, decade)
        const fly = median('fly', sex, decade)
        const back = median('back', sex, decade)
        const breast = median('breast', sex, decade)
        expect(fly).toBeGreaterThan(free)
        expect(back).toBeGreaterThan(fly)
        expect(breast).toBeGreaterThan(fly)
      }
    }
  })

  test('같은 연대에서 여자가 남자보다 느리다', () => {
    for (const stroke of STROKES) {
      for (const decade of DECADES) {
        expect(median(stroke, 'F', decade)).toBeGreaterThan(median(stroke, 'M', decade))
      }
    }
  })

  // 50·60대를 뺀 이유가 각각 다르다. 50대는 **여덟 분포 전부**에서 커트라인이 젊은
  // 연대보다 빠르게 나온다(`distributions.ts` 머리말 — 전사 오류가 아니라 원본이 그렇다).
  // 60대는 표본이 300~680건이라 상위 5%가 몇 건에 좌우된다.
  test('상위 5% 커트라인도 20~40대에서는 나이 순서를 지킨다', () => {
    for (const stroke of STROKES) {
      for (const sex of SEXES) {
        const cuts = ([20, 30, 40] as const).map((decade) =>
          timeForTopPercent(5, findDistribution(stroke, 50, sex, decade)!),
        )
        for (let i = 1; i < cuts.length; i++) expect(cuts[i]!).toBeGreaterThan(cuts[i - 1]!)
      }
    }
  })

  test('50m 네 영법 남녀 20~60대가 모두 들어와 있다', () => {
    for (const stroke of STROKES)
      for (const sex of SEXES)
        for (const decade of DECADES) expect(findDistribution(stroke, 50, sex, decade)).toBeDefined()
  })
})

describe('findDistribution', () => {
  test('없는 종목은 undefined — 25m·100m 는 아직 분포가 없다', () => {
    expect(findDistribution('breast', 25, 'M', 40)).toBeUndefined()
    expect(findDistribution('fly', 100, 'M', 40)).toBeUndefined()
    expect(findDistribution('free', 100, 'M', 40)).toBeUndefined()
    expect(findDistribution('free', 25, 'M', 40)).toBeUndefined()
  })
})
