import { describe, expect, test } from 'bun:test'
import { grade, loadLevel, recordLevel } from './grading'
import { parseTime } from './pace'
import type { RaceEvent } from './types'

const FREE_100: RaceEvent = { stroke: 'free', distance: 100 }
const at = (time: string): number => parseTime(time)!

describe('recordLevel · 100m 자유형 남자', () => {
  test('1:05 → 최상급', () => expect(recordLevel(at('1:05.00'), FREE_100, 'M')).toBe('elite'))
  test('1:15 → 고급', () => expect(recordLevel(at('1:15.00'), FREE_100, 'M')).toBe('advanced'))
  test('1:30 → 중급', () => expect(recordLevel(at('1:30.00'), FREE_100, 'M')).toBe('intermediate'))
  test('1:50 → 초급', () => expect(recordLevel(at('1:50.00'), FREE_100, 'M')).toBe('beginner'))
})

describe('성별·영법 보정', () => {
  test('여자는 같은 기록에서 한 단계 위로 잡힌다', () => {
    const time = at('1:14.00')
    expect(recordLevel(time, FREE_100, 'M')).toBe('advanced')
    expect(recordLevel(time, FREE_100, 'F')).toBe('elite')
  })

  test('평영은 자유형보다 느린 기록에도 같은 등급이 나온다', () => {
    const breast: RaceEvent = { stroke: 'breast', distance: 100 }
    expect(recordLevel(at('1:25.00'), breast, 'M')).toBe('advanced')
    expect(recordLevel(at('1:25.00'), FREE_100, 'M')).toBe('intermediate')
  })
})

describe('거리 환산', () => {
  test('50m 30초는 100m 1:04 와 비슷한 등급이다', () => {
    const free50: RaceEvent = { stroke: 'free', distance: 50 }
    expect(recordLevel(at('30.00'), free50, 'M')).toBe('elite')
    expect(recordLevel(at('34.00'), free50, 'M')).toBe('advanced')
  })

  test('지수가 1.06 이면 후해지던 25m 도 구간이 갈린다', () => {
    const free25: RaceEvent = { stroke: 'free', distance: 25 }
    expect(recordLevel(at('14.00'), free25, 'M')).toBe('elite')
    expect(recordLevel(at('17.00'), free25, 'M')).toBe('advanced')
  })
})

describe('loadLevel', () => {
  test('주 2회는 거리를 채워도 초급', () => {
    expect(loadLevel({ sessionsPerWeek: 2, metersPerSession: 5000 })).toBe('beginner')
  })

  test('주 6회지만 세션당 1,000m 면 두 축 중 낮은 쪽을 쓴다', () => {
    expect(loadLevel({ sessionsPerWeek: 6, metersPerSession: 1000 })).toBe('intermediate')
  })

  test('주 5회 × 3,000m 는 최상급', () => {
    expect(loadLevel({ sessionsPerWeek: 5, metersPerSession: 3000 })).toBe('elite')
  })
})

describe('grade', () => {
  test('강도와 분량을 따로 배정한다', () => {
    const result = grade(at('1:05.00'), FREE_100, 'M', { sessionsPerWeek: 2, metersPerSession: 1500 })
    expect(result.intensity).toBe('elite')
    expect(result.volume).toBe('beginner')
  })

  test('두 축이 2단계 이상 벌어지면 안내한다', () => {
    const result = grade(at('1:05.00'), FREE_100, 'M', { sessionsPerWeek: 2, metersPerSession: 1500 })
    expect(result.mismatch).toContain('훈련 횟수')
  })

  test('한 단계 차이는 안내하지 않는다', () => {
    const result = grade(at('1:30.00'), FREE_100, 'M', { sessionsPerWeek: 4, metersPerSession: 2500 })
    expect(result.mismatch).toBeNull()
  })
})
