import { describe, expect, test } from 'bun:test'
import { forMethod, suggestedTargetCs, verdict, WINDOW, type SetLog } from './log'

const log = (date: string, completedReps: number, methodId = 'rp25'): SetLog => ({
  date,
  methodId,
  plannedReps: 20,
  completedReps,
})

describe('forMethod', () => {
  test('다른 방법의 기록은 섞이지 않는다', () => {
    const logs = [log('2026-07-01', 10), log('2026-07-02', 12, 'rp50')]
    expect(forMethod(logs, 'rp25')).toHaveLength(1)
  })

  test('날짜 오름차순으로 정렬한다', () => {
    const logs = [log('2026-07-05', 10), log('2026-07-01', 12)]
    expect(forMethod(logs, 'rp25').map((entry) => entry.date)).toEqual([
      '2026-07-01',
      '2026-07-05',
    ])
  })
})

describe('verdict', () => {
  test('기록이 없으면 판정하지 않는다', () => {
    const result = verdict([], 'rp25')
    expect(result.kind).toBe('unknown')
    expect(result.attempts).toBe(0)
  })

  test('세 번이 모이기 전에는 판정을 보류한다 — 한 번 무너진 건 컨디션이다', () => {
    const result = verdict([log('2026-07-01', 4), log('2026-07-03', 5)], 'rp25')
    expect(result.kind).toBe('unknown')
    expect(result.attempts).toBe(2)
    expect(result.message).toContain(`${WINDOW}회가 모이면`)
  })

  test('세 번 연속 절반도 못 채우면 목표가 이르다', () => {
    const result = verdict(
      [log('2026-07-01', 8), log('2026-07-03', 9), log('2026-07-05', 7)],
      'rp25',
    )
    expect(result.kind).toBe('too-hard')
    expect(result.message).toContain('이릅니다')
  })

  test('거의 다 채우면 목표를 당길 때다', () => {
    const result = verdict(
      [log('2026-07-01', 20), log('2026-07-03', 19), log('2026-07-05', 20)],
      'rp25',
    )
    expect(result.kind).toBe('ready')
    expect(result.message).toContain('당길 때')
  })

  test('중간이면 지금 목표가 맞다', () => {
    const result = verdict(
      [log('2026-07-01', 15), log('2026-07-03', 16), log('2026-07-05', 14)],
      'rp25',
    )
    expect(result.kind).toBe('on-track')
  })

  test('최근 세 번만 본다 — 옛 기록이 판정을 끌고 다니지 않는다', () => {
    const result = verdict(
      [
        log('2026-01-01', 2),
        log('2026-01-02', 2),
        log('2026-07-01', 20),
        log('2026-07-03', 20),
        log('2026-07-05', 20),
      ],
      'rp25',
    )
    expect(result.kind).toBe('ready')
  })

  test('계획이 0 이어도 나눗셈이 깨지지 않는다', () => {
    const zero: SetLog[] = Array.from({ length: 3 }, (_, i) => ({
      date: `2026-07-0${i + 1}`,
      methodId: 'rp25',
      plannedReps: 0,
      completedReps: 0,
    }))
    expect(verdict(zero, 'rp25').ratio).toBe(0)
  })
})

describe('suggestedTargetCs', () => {
  const target = 8000 // 1:20.00

  test('목표가 이르면 늦춘다', () => {
    const result = verdict(
      [log('2026-07-01', 6), log('2026-07-03', 5), log('2026-07-05', 7)],
      'rp25',
    )
    const suggested = suggestedTargetCs(target, result)
    expect(suggested).not.toBeNull()
    expect(suggested!).toBeGreaterThan(target)
  })

  test('한 번에 2% 를 넘겨 늦추지 않는다 — 목표가 매주 흔들리면 앵커가 아니다', () => {
    const result = verdict(
      [log('2026-07-01', 0), log('2026-07-03', 0), log('2026-07-05', 0)],
      'rp25',
    )
    expect(suggestedTargetCs(target, result)!).toBeLessThanOrEqual(Math.round(target * 1.02))
  })

  test('다 채우면 1% 당긴다', () => {
    const result = verdict(
      [log('2026-07-01', 20), log('2026-07-03', 20), log('2026-07-05', 20)],
      'rp25',
    )
    expect(suggestedTargetCs(target, result)).toBe(Math.round(target * 0.99))
  })

  test('판정이 없거나 적정이면 건드리지 않는다', () => {
    expect(suggestedTargetCs(target, verdict([], 'rp25'))).toBeNull()
    const onTrack = verdict(
      [log('2026-07-01', 15), log('2026-07-03', 16), log('2026-07-05', 14)],
      'rp25',
    )
    expect(suggestedTargetCs(target, onTrack)).toBeNull()
  })
})
