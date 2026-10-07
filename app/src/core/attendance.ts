/**
 * 나인틴 훈련 참여 달성률 (기능3).
 *
 * 달성률 = 참석한 모임 ÷ 집계된 모임. "집계된" 이 핵심이다.
 *
 * | 모임 상태 | 분모 | 화면 |
 * | --- | --- | --- |
 * | 취소 | 빠짐 | 제외 · 취소 |
 * | 가입 전 | 빠짐 | 제외 · 가입 전 |
 * | 날짜가 아직 안 옴 | 빠짐 | 예정 |
 * | 지났지만 운영자가 출석을 저장하기 전 | 빠짐 | 집계 전 |
 * | 출석 저장됨 | **들어감** | 참석 / 결석 |
 *
 * 모든 정기모임이 분모다 — 월 목표 횟수는 두지 않는다(PRD-0001 §4.3).
 */
import { addMonths, monthOf } from './dates'
import type { Meeting } from './types'

export type MeetingStatus =
  | 'present'
  | 'absent'
  | 'cancelled'
  | 'before-join'
  | 'upcoming'
  | 'unchecked'

export interface MeetingRow {
  meeting: Meeting
  status: MeetingStatus
}

export interface MonthSummary {
  /** `2026-10` */
  month: string
  attended: number
  /** 분모. 참석 + 결석. */
  counted: number
  /** 0~1. 집계된 모임이 없으면 null — 0% 와 "아직 없음" 은 다르다. */
  rate: number | null
  /** 이 달에 아직 남은 모임 수(예정). */
  upcoming: number
  /** 남은 모임을 다 나오면 도달하는 달성률. 남은 모임이 없으면 null. */
  best: number | null
  /** 최신이 위로. */
  rows: MeetingRow[]
}

export function meetingStatus(
  meeting: Meeting,
  present: ReadonlySet<string>,
  joinedOn: string,
  today: string,
): MeetingStatus {
  if (meeting.cancelled) return 'cancelled'
  if (meeting.date < joinedOn) return 'before-join'
  if (meeting.checkedAt === null) return meeting.date > today ? 'upcoming' : 'unchecked'
  return present.has(meeting.id) ? 'present' : 'absent'
}

/**
 * 한 달 요약.
 *
 * @param presentMeetingIds 이 회원이 참석으로 체크된 모임 id
 */
export function monthSummary(
  month: string,
  meetings: readonly Meeting[],
  presentMeetingIds: ReadonlySet<string>,
  joinedOn: string,
  today: string,
): MonthSummary {
  const rows = meetings
    .filter((meeting) => monthOf(meeting.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((meeting) => ({
      meeting,
      status: meetingStatus(meeting, presentMeetingIds, joinedOn, today),
    }))

  const attended = rows.filter((row) => row.status === 'present').length
  const counted = attended + rows.filter((row) => row.status === 'absent').length
  const upcoming = rows.filter((row) => row.status === 'upcoming').length

  return {
    month,
    attended,
    counted,
    rate: counted > 0 ? attended / counted : null,
    upcoming,
    best: upcoming > 0 ? (attended + upcoming) / (counted + upcoming) : null,
    rows,
  }
}

/** 최근 n 달, 오래된 달이 앞. 막대그래프 순서 그대로다. */
export function monthHistory(
  endMonth: string,
  count: number,
  meetings: readonly Meeting[],
  presentMeetingIds: ReadonlySet<string>,
  joinedOn: string,
  today: string,
): MonthSummary[] {
  const months: MonthSummary[] = []
  for (let back = count - 1; back >= 0; back--) {
    months.push(monthSummary(addMonths(endMonth, -back), meetings, presentMeetingIds, joinedOn, today))
  }
  return months
}

/** 화면용 정수 퍼센트. 반올림한다 — 6/8 = 75, 2/3 = 67. */
export function percent(rate: number): number {
  return Math.round(rate * 100)
}

/** 오늘 이후(오늘 포함) 첫 모임. 취소된 모임은 건너뛴다. */
export function nextMeeting(meetings: readonly Meeting[], today: string): Meeting | null {
  return (
    meetings
      .filter((meeting) => !meeting.cancelled && meeting.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  )
}
