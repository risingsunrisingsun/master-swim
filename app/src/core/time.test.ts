import { expect, test } from 'bun:test'
import { eventKey, hasMinuteField, parseEventKey, readTime, SET_EVENTS, timeFields, timeProblem } from './time'

test('두 칸 입력 — 소수 한 자리는 1/10 초', () => {
  expect(readTime('', '32.4')).toBe(3240)
  expect(readTime('1', '05.3')).toBe(6530)
  expect(readTime('', '65.30')).toBe(6530) // 분 칸이 없는 50m
  expect(readTime('1', '65')).toBeNull()
  expect(readTime('', '')).toBeNull()
})

test('칸으로 되돌리기 — 50m 는 초 칸에 접는다', () => {
  expect(timeFields(6530, 50)).toEqual({ minutes: '', seconds: '65.30' })
  expect(timeFields(6530, 100)).toEqual({ minutes: '1', seconds: '5.30' })
  expect(hasMinuteField(50)).toBe(false)
  expect(hasMinuteField(100)).toBe(true)
})

test('말이 안 되는 기록은 막는다', () => {
  expect(timeProblem(3240, 50)).toBeNull()
  expect(timeProblem(1500, 50)).toContain('너무 빠릅니다')
  expect(timeProblem(60000, 50)).toContain('너무 깁니다')
  expect(timeProblem(null, 50)).not.toBeNull()
})

test('종목 키', () => {
  expect(parseEventKey('free-50')).toEqual({ stroke: 'free', distance: 50 })
  expect(parseEventKey('im-50')).toBeNull()
  expect(parseEventKey('toString-50')).toBeNull()
  expect(eventKey({ stroke: 'im', distance: 100 })).toBe('im-100')
  expect(SET_EVENTS).toHaveLength(8)
})
