import { describe, expect, test } from 'bun:test'
import {
  describeDrylandSet,
  describePoolSet,
  drylandSpec,
  METHODS,
  methodById,
  poolSpec,
} from './methods'
import { LEVEL_ORDER } from './grading'
import { racePace25 } from './pace'

describe('카탈로그 무결성', () => {
  test('id 가 중복되지 않는다', () => {
    const ids = METHODS.map((method) => method.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('모든 방법이 네 등급 키를 갖는다', () => {
    for (const method of METHODS) {
      for (const level of LEVEL_ORDER) {
        expect(method.levels).toHaveProperty(level)
      }
    }
  })

  test('같은 카테고리가 연속해 있다 — 목록 화면의 섹션 헤더가 두 번 찍히지 않는다', () => {
    const seen = new Set<string>()
    let previous = ''

    for (const method of METHODS) {
      if (method.category === previous) continue
      expect(seen.has(method.category)).toBe(false)
      seen.add(method.category)
      previous = method.category
    }
  })

  test('모든 방법에 목적·원리·주의점이 있다', () => {
    for (const method of METHODS) {
      expect(method.purpose.length).toBeGreaterThan(0)
      expect(method.principle.length).toBeGreaterThan(0)
      expect(method.cautions.length).toBeGreaterThan(0)
    }
  })

  test('등급이 올라갈수록 분량이 줄지 않는다', () => {
    for (const method of METHODS) {
      const volumes = LEVEL_ORDER.map((level) =>
        method.kind === 'pool'
          ? (method.levels[level]?.reps ?? 0)
          : (method.levels[level]?.sets ?? 0),
      )

      for (let i = 1; i < volumes.length; i++) {
        // null 인 등급(0)은 건너뛴다 — 젖산 내성은 초급에 처방하지 않는다.
        if (volumes[i - 1] === 0) continue
        expect(volumes[i]!).toBeGreaterThanOrEqual(volumes[i - 1]!)
      }
    }
  })
})

describe('describePoolSet', () => {
  const pace = racePace25(8000, 100) // 100m 목표 1:20.00 → 25m 20.18

  test('레이스페이스 세트에 페이스와 인터벌이 들어간다', () => {
    expect(describePoolSet(poolSpec('rp25', 'advanced')!, pace, 100)).toBe(
      '20 × 25m @ 20.18 · 인터벌 32.18',
    )
  })

  test('50m 반복은 페이스가 두 배로 계산된다', () => {
    expect(describePoolSet(poolSpec('rp50', 'elite')!, pace, 100)).toContain('12 × 50m @ 40.35')
  })

  test('브로큰은 목표보다 빠른 페이스를 지시한다', () => {
    expect(describePoolSet(poolSpec('broken', 'advanced')!, pace, 100)).toContain(
      '4 × 100m @ 1:19.50',
    )
  })

  test('전력 세트는 페이스를 표시하지 않는다', () => {
    expect(describePoolSet(poolSpec('sprint-power', 'advanced')!, pace, 100)).toBe('8 × 25m 전력')
  })

  test('거리 0 인 세트는 목표 종목 거리를 쓴다', () => {
    expect(describePoolSet(poolSpec('time-trial', 'beginner')!, pace, 50)).toBe('1 × 50m 전력')
  })

  test('노력도 세트도 휴식은 보여준다 — 인터벌은 계산할 수 없다', () => {
    expect(describePoolSet(poolSpec('aerobic', 'beginner')!, pace, 100)).toBe(
      '4 × 100m 편하게 · 휴식 30초',
    )
  })

  test('휴식이 없는 노력도 세트는 노력도만 표시한다', () => {
    expect(describePoolSet(poolSpec('underwater', 'elite')!, pace, 100)).toBe('10 × 15m 기술 위주')
  })
})

describe('describeDrylandSet', () => {
  test('세트 × 횟수로 표기한다', () => {
    expect(describeDrylandSet(drylandSpec('rotator-cuff', 'intermediate')!)).toBe('3세트 × 12~15회')
  })
})

describe('접근자', () => {
  test('육상 방법을 poolSpec 으로 요청하면 null', () => {
    expect(poolSpec('rotator-cuff', 'advanced')).toBeNull()
  })

  test('수영장 방법을 drylandSpec 으로 요청하면 null', () => {
    expect(drylandSpec('rp25', 'advanced')).toBeNull()
  })
})

describe('안전 관련', () => {
  test('젖산 내성은 초급에 처방하지 않는다', () => {
    expect(poolSpec('lactate-tolerance', 'beginner')).toBeNull()
  })

  test('잠영 세트는 의식 소실 위험을 경고한다', () => {
    expect(methodById('underwater')!.cautions.join(' ')).toContain('의식 소실')
  })
})
