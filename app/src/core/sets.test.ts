import { describe, expect, test } from 'bun:test'
import {
  bracketOf,
  clockLabel,
  describeLine,
  formulaPlan,
  MAX_STEPS,
  parsePlan,
  planProblem,
  prescribe,
  type SetOverride,
  type SetPlan,
  viewLine,
} from './sets'

const FREE50 = { stroke: 'free', distance: 50 } as const
const FREE100 = { stroke: 'free', distance: 100 } as const

describe('단계', () => {
  test('1초씩 끊는다 — 마지막 단계는 목표에서 멈춘다', () => {
    const p = prescribe(FREE50, 3240, 3100, [])!
    expect(p.gapCs).toBe(140)
    expect(p.percent).toBeCloseTo(4.32, 2)
    expect(p.steps.map((s) => [s.fromCs, s.toCs, s.bracket])).toEqual([
      [3240, 3140, 1],
      [3140, 3100, 2],
    ])
    expect(p.truncated).toBe(false)
  })

  test('PRD 예시 — 자유형 50m 32.40 → 31.40 의 25m 목표는 다이빙 이득만큼 느리다', () => {
    const p = prescribe(FREE50, 3240, 3140, [])!
    // (31.40 + 0.70) / 2 = 16.05
    expect(p.steps[0]!.pace25Cs).toBe(1605)
    expect(p.diveShareCs).toBe(35)
  })

  test('목표가 같거나 느리면 처방하지 않는다', () => {
    expect(prescribe(FREE50, 3240, 3240, [])).toBeNull()
    expect(prescribe(FREE50, 3240, 3300, [])).toBeNull()
  })

  test('5초 넘는 목표는 앞 다섯 단계만', () => {
    const p = prescribe(FREE100, 9000, 8000, [])!
    expect(p.steps).toHaveLength(MAX_STEPS)
    expect(p.truncated).toBe(true)
    expect(p.steps.slice(2).every((s) => s.bracket === 3)).toBe(true)
  })

  test('구간', () => {
    expect([1, 2, 3, 4].map(bracketOf)).toEqual([1, 2, 3, 3])
  })
})

describe('공식 기본값', () => {
  test('50m 첫 1초는 레이스 페이스 + 스타트', () => {
    const plan = formulaPlan(FREE50, 1, 3240)
    expect(plan.lines.map((l) => l.name)).toEqual(['레이스 페이스 25', '스타트 반복'])
    expect(plan.perWeek).toBe(2)
    expect(plan.weeks).toBe(4)
  })

  test('100m 2초 넘게의 브로큰은 페이스보다 빠르게, 초급에는 젖산 내성이 없다', () => {
    const fast = formulaPlan(FREE100, 3, 7000)
    expect(fast.lines.map((l) => l.name)).toEqual(['브로큰 스윔', '젖산 내성'])
    expect(fast.lines[0]!.paceOffsetCs).toBe(-50)
    const slow = formulaPlan(FREE100, 3, 12000)
    expect(slow.lines.map((l) => l.name)).toEqual(['브로큰 스윔'])
  })

  test('기록이 느릴수록 반복이 적고 휴식이 길다', () => {
    const fast = formulaPlan(FREE50, 1, 2700).lines[0]!
    const slow = formulaPlan(FREE50, 1, 5000).lines[0]!
    expect(fast.reps).toBeGreaterThan(slow.reps)
    expect(fast.restS!).toBeLessThan(slow.restS!)
  })
})

describe('세트 줄', () => {
  test('목표 시간과 5초 단위 인터벌', () => {
    const view = viewLine(
      { name: 'RP', reps: 16, distance: 25, restS: 15, effort: 'pace', paceOffsetCs: 0, note: '' },
      1605,
    )
    expect(view.targetCs).toBe(1605)
    expect(view.intervalCs).toBe(3500) // 16.05 + 15 = 31.05 → 35초
    expect(describeLine(view)).toBe('RP · 16 × 25m · @ 16.05 · 인터벌 35초')
  })

  test('노력도 세트는 시간이 없다', () => {
    const view = viewLine(
      { name: '스타트', reps: 6, distance: 15, restS: null, effort: 'max', paceOffsetCs: 0, note: '' },
      1605,
    )
    expect(view.targetCs).toBeNull()
    expect(describeLine(view)).toBe('스타트 · 6 × 15m · 전력 · 완전 회복')
  })

  test('시계', () => {
    expect(clockLabel(3500)).toBe('35초')
    expect(clockLabel(6000)).toBe('1분')
    expect(clockLabel(6500)).toBe('1분 05초')
  })
})

describe('코치 처방', () => {
  const plan: SetPlan = {
    lines: [{ name: '코치 25', reps: 10, distance: 25, restS: 20, effort: 'pace', paceOffsetCs: 0, note: '' }],
    perWeek: 3,
    weeks: 5,
  }

  test('덮어쓴 구간만 코치 처방, 나머지는 공식', () => {
    const override: SetOverride = { ...FREE50, bracket: 2, plan, updatedAt: '' }
    const p = prescribe(FREE50, 3240, 2940, [override, { ...override, stroke: 'back' }])!
    expect(p.steps.map((s) => s.source)).toEqual(['formula', 'coach', 'formula'])
    expect(p.steps[1]!.lines[0]!.line.name).toBe('코치 25')
  })

  test('검사', () => {
    expect(planProblem(plan)).toBeNull()
    expect(planProblem({ ...plan, lines: [] })).not.toBeNull()
    expect(planProblem({ ...plan, lines: [{ ...plan.lines[0]!, distance: 33 }] })).toContain('거리')
    expect(planProblem({ ...plan, weeks: 0 })).not.toBeNull()
  })

  test('DB JSON 은 모양이 맞을 때만 받는다', () => {
    expect(parsePlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan)
    expect(parsePlan({ lines: [{ name: 'x' }], perWeek: 2, weeks: 2 })).toBeNull()
    expect(parsePlan({ ...plan, lines: [{ ...plan.lines[0], effort: 'toString' }] })).toBeNull()
    expect(parsePlan(null)).toBeNull()
  })
})

test('성별을 알면 여자 기록은 여자 기준 등급으로 — 반복이 더 많다', () => {
  const FREE = { stroke: 'free', distance: 50 } as const
  const unknown = formulaPlan(FREE, 1, 4000).lines[0]!.reps
  const female = formulaPlan(FREE, 1, 4000, 'F').lines[0]!.reps
  expect(female).toBeGreaterThan(unknown)
  expect(formulaPlan(FREE, 1, 4000, 'M')).toEqual(formulaPlan(FREE, 1, 4000))
})
