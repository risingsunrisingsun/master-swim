import { expect, test } from 'bun:test'
import { addMonths, isValidIso, longDateLabel, monthLabel, shortDateLabel, todayIso } from './dates'

test('addMonths 는 해를 넘는다', () => {
  expect(addMonths('2026-10', 3)).toBe('2027-01')
  expect(addMonths('2026-01', -1)).toBe('2025-12')
  expect(addMonths('2026-10', -12)).toBe('2025-10')
})

test('요일은 날짜만으로 — 시간대와 무관', () => {
  expect(shortDateLabel('2026-10-25')).toBe('10/25 일')
  expect(shortDateLabel('2026-10-31')).toBe('10/31 토')
  expect(longDateLabel('2026-10-28')).toBe('10월 28일 수요일')
})

test('monthLabel 은 해가 다를 때만 연도를 붙인다', () => {
  expect(monthLabel('2026-10')).toBe('10월')
  expect(monthLabel('2026-12', '2027-01-03')).toBe('2026년 12월')
  expect(monthLabel('2027-01', '2027-01-03')).toBe('1월')
})

test('todayIso 는 기기 현지 날짜', () => {
  expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
})

test('isValidIso', () => {
  expect(isValidIso('2026-02-28')).toBe(true)
  expect(isValidIso('2026-02-29')).toBe(false)
  expect(isValidIso('2028-02-29')).toBe(true)
  expect(isValidIso('2026-13-01')).toBe(false)
  expect(isValidIso('2026-1-01')).toBe(false)
  expect(isValidIso('')).toBe(false)
})
