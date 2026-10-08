import { describe, expect, test } from 'bun:test'
import { meetingStatus, monthHistory, monthSummary, nextMeeting, percent } from './attendance'
import type { Meeting } from './types'

const meeting = (date: string, extra: Partial<Meeting> = {}): Meeting => ({
  id: date,
  date,
  kind: 'training',
  label: '',
  place: '',
  cancelled: false,
  checkedAt: `${date}T22:00:00Z`,
  ...extra,
})

const TODAY = '2026-10-28'
const JOINED = '2026-01-01'

describe('meetingStatus', () => {
  const present = new Set(['2026-10-02'])

  test('취소가 가장 먼저 — 출석 체크가 있어도 취소면 제외', () => {
    expect(meetingStatus(meeting('2026-10-02', { cancelled: true }), present, JOINED, TODAY)).toBe('cancelled')
  })

  test('가입 전 모임은 제외', () => {
    expect(meetingStatus(meeting('2026-10-02'), present, '2026-10-10', TODAY)).toBe('before-join')
  })

  test('가입한 날 모임은 들어간다', () => {
    expect(meetingStatus(meeting('2026-10-02'), present, '2026-10-02', TODAY)).toBe('present')
  })

  test('지났지만 출석 저장 전이면 결석이 아니라 집계 전', () => {
    expect(meetingStatus(meeting('2026-10-27', { checkedAt: null }), present, JOINED, TODAY)).toBe('unchecked')
  })

  test('오늘 모임도 저장 전이면 집계 전, 내일 모임은 예정', () => {
    expect(meetingStatus(meeting(TODAY, { checkedAt: null }), present, JOINED, TODAY)).toBe('unchecked')
    expect(meetingStatus(meeting('2026-10-29', { checkedAt: null }), present, JOINED, TODAY)).toBe('upcoming')
  })

  test('저장된 모임은 명단에 있으면 참석, 없으면 결석', () => {
    expect(meetingStatus(meeting('2026-10-02'), present, JOINED, TODAY)).toBe('present')
    expect(meetingStatus(meeting('2026-10-07'), present, JOINED, TODAY)).toBe('absent')
  })
})

describe('monthSummary', () => {
  // 와이어프레임의 10월: 집계된 8회 중 6회 참석, 취소 1, 남은 모임 2.
  const presentDates = ['2026-10-02', '2026-10-07', '2026-10-09', '2026-10-14', '2026-10-18', '2026-10-25']
  const meetings = [
    ...presentDates.map((d) => meeting(d)),
    meeting('2026-10-16'),
    meeting('2026-10-23'),
    meeting('2026-10-21', { cancelled: true }),
    meeting('2026-10-30', { checkedAt: null }),
    meeting('2026-10-31', { checkedAt: null }),
    meeting('2026-09-30'), // 다른 달
  ]
  const summary = monthSummary('2026-10', meetings, new Set(presentDates), JOINED, TODAY)

  test('8회 중 6회 = 75%', () => {
    expect(summary.counted).toBe(8)
    expect(summary.attended).toBe(6)
    expect(percent(summary.rate ?? -1)).toBe(75)
  })

  test('남은 2회를 다 나오면 8/10 = 80%', () => {
    expect(summary.upcoming).toBe(2)
    expect(percent(summary.best ?? -1)).toBe(80)
  })

  test('다른 달 모임은 섞이지 않고, 최신이 위', () => {
    expect(summary.rows).toHaveLength(11)
    expect(summary.rows[0]?.meeting.date).toBe('2026-10-31')
    expect(summary.rows.at(-1)?.meeting.date).toBe('2026-10-02')
  })

  test('집계된 모임이 없으면 0% 가 아니라 null', () => {
    const empty = monthSummary('2026-10', [meeting('2026-10-30', { checkedAt: null })], new Set(), JOINED, TODAY)
    expect(empty.rate).toBeNull()
    expect(empty.best).toBe(1)
  })

  test('남은 모임이 없으면 best 는 null', () => {
    const done = monthSummary('2026-09', [meeting('2026-09-30')], new Set(), JOINED, TODAY)
    expect(done.rate).toBe(0)
    expect(done.best).toBeNull()
  })
})

describe('monthHistory', () => {
  test('오래된 달이 앞, 해를 넘는다', () => {
    const history = monthHistory('2027-02', 6, [], new Set(), JOINED, TODAY)
    expect(history.map((m) => m.month)).toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02'])
  })
})

describe('nextMeeting', () => {
  test('오늘 포함, 취소 건너뜀', () => {
    const meetings = [meeting('2026-10-27'), meeting(TODAY, { cancelled: true }), meeting('2026-11-04'), meeting('2026-10-30')]
    expect(nextMeeting(meetings, TODAY)?.date).toBe('2026-10-30')
    expect(nextMeeting(meetings, '2026-11-05')).toBeNull()
  })
})

test('percent 는 반올림', () => {
  expect(percent(2 / 3)).toBe(67)
  expect(percent(1 / 8)).toBe(13)
})
