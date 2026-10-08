/**
 * 운영자 기록 내려받기 — 회원 전원의 기록을 엑셀 시트 두 장으로.
 *
 * 1. **전체 기록** — 한 줄에 기록 하나. 이름 · 종목 · 날짜 순.
 * 2. **회원별 최고기록** — 회원 × 종목마다 한 줄.
 *
 * 기록은 `1:05.30` 글자와 `65.3` 숫자(초)를 함께 싣는다. 글자는 읽기 좋고, 숫자는
 * 엑셀에서 정렬 · 평균을 낼 수 있다.
 */
import { pbIds, personalBest } from './records'
import { eventKey, formatTime } from './time'
import {
  type Meeting,
  meetingKindLabel,
  type Member,
  RECORD_EVENTS,
  SEX_LABEL,
  STROKE_LABEL,
  type SwimRecord,
} from './types'
import type { Sheet } from './xlsx'

export const exportFileName = (today: string): string => `나인틴_기록_${today}.xlsx`

const EVENT_ORDER = new Map(RECORD_EVENTS.map((e, i) => [eventKey(e), i]))
const seconds = (cs: number): number => Math.round(cs) / 100

export function recordSheets(
  members: readonly Member[],
  records: readonly SwimRecord[],
  meetings: readonly Meeting[],
): Sheet[] {
  const names = new Map(members.map((m) => [m.id, m.displayName]))
  const nameOf = (id: string) => names.get(id) ?? '(지워진 회원)'
  const meetingById = new Map(meetings.map((m) => [m.id, m]))

  const byMember = new Map<string, SwimRecord[]>()
  for (const r of records) byMember.set(r.memberId, [...(byMember.get(r.memberId) ?? []), r])

  // PB 는 회원마다 따로 센다 — 남의 기록과 섞으면 안 된다.
  const pb = new Set<string>()
  for (const list of byMember.values()) for (const id of pbIds(list)) pb.add(id)

  const sorted = [...records].sort(
    (a, b) =>
      nameOf(a.memberId).localeCompare(nameOf(b.memberId), 'ko') ||
      (EVENT_ORDER.get(eventKey(a)) ?? 0) - (EVENT_ORDER.get(eventKey(b)) ?? 0) ||
      a.date.localeCompare(b.date),
  )

  const all: Sheet = {
    name: '전체 기록',
    widths: [12, 12, 10, 8, 10, 9, 10, 28, 24, 6],
    rows: [
      ['이름', '날짜', '영법', '거리(m)', '기록', '기록(초)', '출처', '모임', '메모', 'PB'],
      ...sorted.map((r) => {
        const meeting = r.meetingId ? meetingById.get(r.meetingId) : undefined
        return [
          nameOf(r.memberId),
          r.date,
          STROKE_LABEL[r.stroke],
          r.distance,
          formatTime(r.timeCs),
          seconds(r.timeCs),
          r.source === 'meeting' ? '모임 기록' : '개인 입력',
          meeting ? `${meeting.date} ${meetingKindLabel(meeting)}${meeting.place ? ` · ${meeting.place}` : ''}` : '',
          r.note,
          pb.has(r.id) ? 'PB' : '',
        ]
      }),
    ],
  }

  const bestRows: (string | number | null)[][] = []
  const sortedMembers = [...members].sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'))
  for (const member of sortedMembers) {
    const list = byMember.get(member.id) ?? []
    for (const event of RECORD_EVENTS) {
      const best = personalBest(list, event)
      if (!best) continue
      bestRows.push([
        member.displayName,
        member.sex ? SEX_LABEL[member.sex] : '',
        member.birthYear,
        STROKE_LABEL[event.stroke],
        event.distance,
        formatTime(best.timeCs),
        seconds(best.timeCs),
        best.date,
        list.filter((r) => r.stroke === event.stroke && r.distance === event.distance).length,
      ])
    }
  }

  const bests: Sheet = {
    name: '회원별 최고기록',
    widths: [12, 6, 9, 10, 8, 10, 9, 12, 8],
    rows: [['이름', '성별', '출생연도', '영법', '거리(m)', '최고기록', '기록(초)', '날짜', '기록 수'], ...bestRows],
  }

  return [all, bests]
}
