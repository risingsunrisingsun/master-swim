import { describe, expect, test } from 'bun:test'
import { standing, STANDING_BASIS, toNextLevel } from './benchmark'
import { recordLevel } from './grading'
import { parseTime } from './pace'
import type { RaceEvent } from './types'

const FREE_100: RaceEvent = { stroke: 'free', distance: 100 }
const at = (time: string): number => parseTime(time)!

describe('standing', () => {
  test('빠를수록 위치가 높다', () => {
    expect(standing(at('1:05.00'), FREE_100, 'M').position).toBeGreaterThan(
      standing(at('1:30.00'), FREE_100, 'M').position,
    )
  })

  test('0~100 을 벗어나지 않는다', () => {
    for (const time of ['40.00', '1:07.00', '1:38.00', '3:00.00']) {
      const value = standing(at(time), FREE_100, 'M').position
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  test('등급 경계에서 약속한 값이 나온다', () => {
    expect(standing(at('1:07.00'), FREE_100, 'M').position).toBe(90)
    expect(standing(at('1:20.00'), FREE_100, 'M').position).toBe(70)
    expect(standing(at('1:38.00'), FREE_100, 'M').position).toBe(40)
  })

  test('등급은 grading 과 어긋나지 않는다', () => {
    for (const time of ['1:05.00', '1:15.00', '1:30.00', '1:50.00']) {
      expect(standing(at(time), FREE_100, 'M').level).toBe(recordLevel(at(time), FREE_100, 'M'))
    }
  })

  test('백분위가 아니라는 사실을 항상 함께 돌려준다', () => {
    expect(standing(at('1:20.00'), FREE_100, 'M').basis).toBe(STANDING_BASIS)
    expect(STANDING_BASIS).toContain('백분위가 아닙니다')
  })
})

describe('toNextLevel', () => {
  test('다음 등급과 남은 격차를 알려준다', () => {
    const next = toNextLevel(at('1:30.00'), FREE_100, 'M')
    expect(next?.level).toBe('advanced')
    // 중급 1:30 → 고급 상한 1:20, 약 10초
    expect(next!.gapCs).toBeGreaterThan(900)
    expect(next!.gapCs).toBeLessThan(1100)
  })

  test('격차만큼 줄이면 실제로 등급이 오른다', () => {
    const current = at('1:30.00')
    const next = toNextLevel(current, FREE_100, 'M')!
    // 경계에서 1/100초 더 당기면 확실히 넘어간다
    expect(recordLevel(current - next.gapCs - 1, FREE_100, 'M')).toBe(next.level)
  })

  test('최상급이면 null 이다', () => {
    expect(toNextLevel(at('1:00.00'), FREE_100, 'M')).toBeNull()
  })

  test('영법이 달라도 성립한다', () => {
    const breast: RaceEvent = { stroke: 'breast', distance: 100 }
    const next = toNextLevel(at('1:50.00'), breast, 'M')!
    expect(recordLevel(at('1:50.00') - next.gapCs - 1, breast, 'M')).toBe(next.level)
  })
})
