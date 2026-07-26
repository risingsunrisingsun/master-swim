import { describe, expect, test } from 'bun:test'
import {
  decadeOf,
  DISTRIBUTIONS,
  findDistribution,
  percentileBeaten,
  timeForTopPercent,
} from './distributions'
import { parseTime } from './pace'

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

describe('분포가 상식과 맞는가', () => {
  test('같은 종목에서 나이가 많을수록 중앙값이 느려진다 (자유형 50m 남자)', () => {
    const medians = ([20, 30, 40, 50, 60] as const).map((decade) =>
      timeForTopPercent(50, findDistribution('free', 50, 'M', decade)!),
    )
    for (let i = 1; i < medians.length; i++) expect(medians[i]!).toBeGreaterThan(medians[i - 1]!)
  })

  test('같은 연대에서 배영이 자유형보다 느리다', () => {
    for (const decade of [20, 30, 40, 60] as const) {
      const free = timeForTopPercent(50, findDistribution('free', 50, 'M', decade)!)
      const back = timeForTopPercent(50, findDistribution('back', 50, 'M', decade)!)
      expect(back).toBeGreaterThan(free)
    }
  })

  test('같은 연대에서 여자가 남자보다 느리다', () => {
    for (const decade of [20, 30, 40, 50, 60] as const) {
      const men = timeForTopPercent(50, findDistribution('free', 50, 'M', decade)!)
      const women = timeForTopPercent(50, findDistribution('free', 50, 'F', decade)!)
      expect(women).toBeGreaterThan(men)
    }
  })
})

describe('findDistribution', () => {
  test('없는 종목은 undefined', () => {
    expect(findDistribution('breast', 50, 'M', 40)).toBeUndefined()
    expect(findDistribution('free', 100, 'M', 40)).toBeUndefined()
    expect(findDistribution('free', 25, 'M', 40)).toBeUndefined()
  })
})
