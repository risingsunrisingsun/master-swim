/**
 * `YYYY-MM-DD` 문자열 날짜 다루기.
 *
 * `Date` 를 거치면 UTC 로 해석돼 한국 시간 아침 9시 전에는 하루가 밀린다.
 * 연·월·일 숫자로만 계산한다.
 */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 기기 시계 기준 오늘. 회원은 전부 한국에 있다. */
export function todayIso(now: Date = new Date()): string {
  return isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function isoOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

/** `2026-10` */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

/** `2026-10` 에서 n 달 전후. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const index = y * 12 + (m - 1) + n
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`
}

/** `10월` — 해가 바뀌는 경계에서는 `2027년 1월`. */
export function monthLabel(month: string, reference?: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  if (reference && reference.slice(0, 4) !== String(y)) return `${y}년 ${m}월`
  return `${m}월`
}

/** `10/25 토` */
export function shortDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return `${m}/${d} ${weekdayOf(y, m, d)}`
}

/** `10월 28일 화요일` */
export function longDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return `${m}월 ${d}일 ${weekdayOf(y, m, d)}요일`
}

export function isValidIso(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  if (m < 1 || m > 12 || d < 1) return false
  return d <= daysInMonth(y, m)
}

function weekdayOf(y: number, m: number, d: number): string {
  // 날짜만으로 요일을 구한다(시간대 무관).
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? ''
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
