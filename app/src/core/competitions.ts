/**
 * 대회 참가 신청 취합. 순수 함수만.
 *
 * 운영자가 대회를 열고(종목 · 마감일 · 한 사람당 종목 수), 회원이 개인 종목과 단체전 참가 의사를
 * 남긴다. 운영자는 신청을 엑셀로 받아 대회 쪽 신청서에 옮긴다. 단체전 명단(`relay.ts`)은
 * "단체전 나갈 수 있음"에 표시한 회원에서 짠다.
 *
 * 대회 일정 · 결과 모음은 만들지 않는다 — 마이랭킹과 카페가 한다(CONTEXT.md).
 */
import { shortDateLabel } from './dates'
import { eventKey, eventLabel, sameEvent } from './time'
import {
  type Competition,
  COMPETITION_NAME_MAX,
  type CompetitionEntry,
  type CompetitionInput,
  MAX_EVENTS_LIMIT,
  type Member,
  RECORD_EVENTS,
  SEX_LABEL,
  type SwimEvent,
} from './types'
import type { Sheet } from './xlsx'

/** 마감일 당일까지 열려 있다. */
export const isOpen = (competition: Pick<Competition, 'deadline'>, today: string): boolean => competition.deadline >= today

/** 홈에 보일 대회 — 마감 전이거나, 마감했어도 대회 날이 지나지 않은 것. 가까운 날 순. */
export function upcomingCompetitions(competitions: readonly Competition[], today: string): Competition[] {
  return competitions.filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date))
}

/** 회원이 고른 종목이 이 대회에서 받을 수 있는지. 문제가 있으면 그 문구. */
export function entryProblem(competition: Competition, events: readonly SwimEvent[], relay: boolean, today: string): string | null {
  if (!isOpen(competition, today)) return `${shortDateLabel(competition.deadline)}에 신청이 마감됐습니다. 운영진에게 문의하세요.`
  if (events.length === 0 && !relay) return '개인 종목을 하나 이상 고르거나 단체전에 표시해 주세요.'
  if (relay && !competition.relays) return '이 대회는 단체전 신청을 받지 않습니다.'
  if (events.length > competition.maxEvents) return `개인 종목은 ${competition.maxEvents}개까지 고를 수 있습니다.`
  const keys = new Set<string>()
  for (const event of events) {
    if (!competition.events.some((e) => sameEvent(e, event))) return `${eventLabel(event)}은 이 대회 종목이 아닙니다.`
    if (keys.has(eventKey(event))) return `${eventLabel(event)}을 두 번 골랐습니다.`
    keys.add(eventKey(event))
  }
  return null
}

/** 운영자 입력 검사. */
export function competitionProblem(input: CompetitionInput): string | null {
  const name = input.name.trim()
  if (!name) return '대회 이름을 넣어 주세요.'
  if (name.length > COMPETITION_NAME_MAX) return `대회 이름은 ${COMPETITION_NAME_MAX}자까지입니다.`
  if (input.deadline > input.date) return '신청 마감일은 대회 날보다 늦을 수 없습니다.'
  if (input.events.length === 0 && !input.relays) return '개인 종목을 하나 이상 고르거나 단체전 신청을 켜 주세요.'
  if (!Number.isInteger(input.maxEvents) || input.maxEvents < 1 || input.maxEvents > MAX_EVENTS_LIMIT) {
    return `한 사람당 종목 수는 1~${MAX_EVENTS_LIMIT}개입니다.`
  }
  if (input.note.length > 200) return '안내는 200자까지입니다.'
  return null
}

/** 종목 순서를 기록 종목 표 순서로 맞춘다 — 회원 · 운영자 화면 · 엑셀이 같은 순서로 보인다. */
export function sortEvents(events: readonly SwimEvent[]): SwimEvent[] {
  const order = (e: SwimEvent) => RECORD_EVENTS.findIndex((r) => sameEvent(r, e))
  return [...events].sort((a, b) => order(a) - order(b))
}

export interface EventTally {
  event: SwimEvent
  /** 신청한 회원 이름, 가나다순. */
  names: string[]
}

/** 종목별 신청 명단. 대회 종목 순서 그대로, 신청이 없는 종목도 빈 명단으로 남긴다. */
export function tallyEntries(
  competition: Competition,
  entries: readonly CompetitionEntry[],
  members: readonly Member[],
): { events: EventTally[]; relay: string[] } {
  const name = (id: string) => members.find((m) => m.id === id)?.displayName ?? '(알 수 없음)'
  const byName = (a: string, b: string) => a.localeCompare(b, 'ko')
  return {
    events: sortEvents(competition.events).map((event) => ({
      event,
      names: entries.filter((e) => e.events.some((x) => sameEvent(x, event))).map((e) => name(e.memberId)).sort(byName),
    })),
    relay: entries.filter((e) => e.relay).map((e) => name(e.memberId)).sort(byName),
  }
}

/** `나인틴_<대회 이름>_신청_2026-11-19.xlsx` — 파일 이름에 못 쓰는 글자는 뺀다. */
export const entriesFileName = (competition: Competition, today: string): string =>
  `나인틴_${competition.name.replace(/[\\/:*?"<>|]/g, '').trim()}_신청_${today}.xlsx`

/**
 * 엑셀 두 장. "신청 목록"은 사람별 한 줄(대회 신청서에 옮기기 좋게 성별 · 출생연도를 함께),
 * "종목별"은 종목마다 신청자.
 */
export function entrySheets(competition: Competition, entries: readonly CompetitionEntry[], members: readonly Member[]): Sheet[] {
  const memberOf = (id: string) => members.find((m) => m.id === id)
  const rows = [...entries]
    .map((entry) => ({ entry, member: memberOf(entry.memberId) }))
    .sort((a, b) => (a.member?.displayName ?? '').localeCompare(b.member?.displayName ?? '', 'ko'))
    .map(({ entry, member }) => [
      member?.displayName ?? '(알 수 없음)',
      member?.sex ? SEX_LABEL[member.sex] : '',
      member?.birthYear ?? null,
      sortEvents(entry.events).map(eventLabel).join(', '),
      entry.relay ? '가능' : '',
      entry.note,
      entry.updatedAt.slice(0, 10),
    ])
  const tally = tallyEntries(competition, entries, members)
  const byEvent = [
    ...tally.events.flatMap((t) => t.names.map((n) => [eventLabel(t.event), n])),
    ...(competition.relays ? tally.relay.map((n) => ['단체전 가능', n]) : []),
  ]
  return [
    {
      name: '신청 목록',
      widths: [12, 6, 8, 36, 10, 30, 12],
      rows: [['이름', '성별', '출생연도', '개인 종목', '단체전', '메모', '신청일'], ...rows],
    },
    { name: '종목별', widths: [16, 12], rows: [['종목', '이름'], ...byEvent] },
  ]
}
