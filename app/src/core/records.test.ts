import { expect, test } from 'bun:test'
import { eventsByRecency, latestGoalGap, latestPb, nationalStanding, pbIds, periodStart, personalBest, recordsOf } from './records'
import type { Goal, SwimRecord } from './types'

let n = 0
const rec = (date: string, timeCs: number, extra: Partial<SwimRecord> = {}): SwimRecord => ({
  id: `r${++n}`,
  memberId: 'm1',
  stroke: 'free',
  distance: 50,
  timeCs,
  date,
  source: 'self',
  meetingId: null,
  note: '',
  ...extra,
})

const FREE50 = { stroke: 'free', distance: 50 } as const

test('PB 는 그 시점에 최고를 새로 쓴 기록 — 첫 기록도 PB', () => {
  const a = rec('2026-01-10', 3400)
  const b = rec('2026-02-10', 3500)
  const c = rec('2026-03-10', 3300, { source: 'meeting', meetingId: 'mt' })
  const d = rec('2026-01-05', 6000, { distance: 100 })
  expect([...pbIds([c, b, a, d])].sort()).toEqual([a.id, c.id, d.id].sort())
  expect(personalBest([a, b, c, d], FREE50)?.id).toBe(c.id)
  expect(latestPb([a, b, c, d])?.id).toBe(c.id)
  expect(recordsOf([c, b, a, d], FREE50).map((r) => r.id)).toEqual([a.id, b.id, c.id])
})

test('기간은 오늘에서 달 수만큼 거슬러 같은 날부터', () => {
  expect(periodStart('3m', '2026-10-08')).toBe('2026-07-08')
  expect(periodStart('1y', '2026-01-31')).toBe('2025-01-31')
  expect(periodStart('all', '2026-10-08')).toBeNull()
})

test('종목은 마지막으로 기록한 순', () => {
  const list = [
    rec('2026-01-01', 3400),
    rec('2026-05-01', 4000, { stroke: 'back' }),
    rec('2026-03-01', 7000, { distance: 100 }),
  ]
  expect(eventsByRecency(list)).toEqual([
    { stroke: 'back', distance: 50 },
    { stroke: 'free', distance: 100 },
    { stroke: 'free', distance: 50 },
  ])
})

test('남은 초는 가장 최근 목표와 지금 최고기록의 차이', () => {
  const goals: Goal[] = [
    { ...FREE50, targetCs: 3200, updatedAt: '2026-10-01T00:00:00Z' },
    { stroke: 'back', distance: 50, targetCs: 3800, updatedAt: '2026-09-01T00:00:00Z' },
  ]
  const gap = latestGoalGap(goals, [rec('2026-01-01', 3400), rec('2026-02-01', 3290)])
  expect(gap?.goal.stroke).toBe('free')
  expect(gap?.remainingCs).toBe(90)
  expect(latestGoalGap(goals, [])?.remainingCs).toBeNull()
  expect(latestGoalGap([], [])).toBeNull()
})

test('국내 마스터즈 위치 — 성별 · 출생연도가 있고 분포가 있는 종목만', () => {
  const FREE100 = { stroke: 'free', distance: 100 } as const
  const s = nationalStanding(3000, FREE50, 'M', 1981, '2026-10-08')!
  expect(s.group).toBe('남자 40대')
  expect(s.topPercent).toBeGreaterThanOrEqual(1)
  expect(s.topPercent).toBeLessThanOrEqual(100)
  expect(s.sampleSize).toBeGreaterThan(0)
  // 더 빠르면 더 위
  expect(nationalStanding(2800, FREE50, 'M', 1981, '2026-10-08')!.topPercent).toBeLessThan(s.topPercent)
  expect(nationalStanding(3000, FREE50, null, 1981, '2026-10-08')).toBeNull()
  expect(nationalStanding(3000, FREE50, 'M', null, '2026-10-08')).toBeNull()
  expect(nationalStanding(7000, FREE100, 'M', 1981, '2026-10-08')).toBeNull()
  expect(nationalStanding(3000, FREE50, 'F', 1950, '2026-10-08')!.group).toBe('여자 60대 이상')
})
