import { describe, expect, test } from 'bun:test'
import { adminCompetitionHtml, adminCompetitionsHtml, competitionHtml, eventCheckHtml } from '../ui/competitions'
import {
  competitionEventKey,
  competitionEventLabel,
  competitionProblem,
  entriesFileName,
  entryProblem,
  entrySheets,
  parseCompetitionEventKey,
  sortEvents,
  tallyEntries,
  upcomingCompetitions,
} from './competitions'
import type { Competition, CompetitionEntry, CompetitionEvent, Member } from './types'

const EVIL = '<img src=x onerror=alert(1)>'
const free50 = { stroke: 'free' as const, distance: 50, fins: false }
const back50 = { stroke: 'back' as const, distance: 50, fins: false }
const free100 = { stroke: 'free' as const, distance: 100, fins: false }

const competition = (over: Partial<Competition> = {}): Competition => ({
  id: 'c1',
  name: '가을 대회',
  date: '2026-12-19',
  place: '',
  deadline: '2026-12-03',
  events: [free100, free50, back50],
  relays: true,
  maxEvents: 2,
  note: '',
  ...over,
})

const member = (id: string, displayName: string, over: Partial<Member> = {}): Member => ({
  id,
  displayName,
  role: 'member',
  status: 'active',
  joinedOn: '2026-01-01',
  sex: null,
  birthYear: null,
  naverLinked: false,
  ...over,
})

const entry = (memberId: string, events: CompetitionEvent[] = [free50], relay = false, note = ''): CompetitionEntry => ({
  competitionId: 'c1',
  memberId,
  events,
  relay,
  note,
  updatedAt: '2026-11-19T00:00:00.000Z',
})

describe('회원 신청 검사', () => {
  test('마감일 당일까지 받는다', () => {
    expect(entryProblem(competition(), [free50], false, '2026-12-03')).toBeNull()
    expect(entryProblem(competition(), [free50], false, '2026-12-04')).toContain('마감')
  })

  test('종목 · 개수 · 겹침 · 단체전', () => {
    expect(entryProblem(competition(), [], false, '2026-11-19')).toContain('하나 이상')
    expect(entryProblem(competition(), [], true, '2026-11-19')).toBeNull() // 단체전만 나가도 된다
    expect(entryProblem(competition({ relays: false }), [], true, '2026-11-19')).toContain('단체전')
    expect(entryProblem(competition(), [free50, back50, free100], false, '2026-11-19')).toContain('2개까지')
    expect(entryProblem(competition(), [{ stroke: 'fly', distance: 50, fins: false }], false, '2026-11-19')).toContain('대회 종목이 아닙니다')
    expect(entryProblem(competition(), [free50, free50], false, '2026-11-19')).toContain('두 번')
  })
})

test('운영자 입력 검사', () => {
  const input = { ...competition(), id: undefined }
  expect(competitionProblem(input)).toBeNull()
  expect(competitionProblem({ ...input, name: '  ' })).toContain('이름')
  expect(competitionProblem({ ...input, deadline: '2026-12-20' })).toContain('마감일')
  expect(competitionProblem({ ...input, events: [], relays: false })).toContain('하나 이상')
  expect(competitionProblem({ ...input, maxEvents: 0 })).toContain('종목 수')
})

test('홈에 보일 대회 — 날이 지나지 않은 것, 가까운 순', () => {
  const list = [competition({ id: 'b', date: '2027-01-10' }), competition({ id: 'a' }), competition({ id: 'old', date: '2026-11-01' })]
  expect(upcomingCompetitions(list, '2026-11-19').map((c) => c.id)).toEqual(['a', 'b'])
})

test('종목별 · 단체전 명단은 대회 종목 순서 그대로, 이름은 가나다순', () => {
  const members = [member('m1', '홍길동'), member('m2', '김철수')]
  const tally = tallyEntries(competition(), [entry('m1', [free50, free100], true), entry('m2', [free50], true)], members)
  expect(tally.events.map((t) => [t.event.stroke, t.event.distance, t.names])).toEqual([
    ['free', 50, ['김철수', '홍길동']],
    ['free', 100, ['홍길동']],
    ['back', 50, []],
  ])
  expect(tally.relay).toEqual(['김철수', '홍길동'])
})

test('엑셀 — 사람별 한 줄에 성별 · 출생연도, 종목별 시트', () => {
  const members = [member('m1', '홍길동', { sex: 'M', birthYear: 1975 })]
  const [people, byEvent] = entrySheets(competition(), [entry('m1', [free100, free50], true, '오전만')], members)
  expect(people!.rows[1]).toEqual(['홍길동', '남', 1975, '자유형 50m, 자유형 100m', '가능', '오전만', '2026-11-19'])
  expect(byEvent!.rows).toEqual([
    ['종목', '이름'],
    ['자유형 50m', '홍길동'],
    ['자유형 100m', '홍길동'],
    ['단체전 가능', '홍길동'],
  ])
  expect(entriesFileName(competition({ name: '가을/대회?' }), '2026-11-19')).toBe('나인틴_가을대회_신청_2026-11-19.xlsx')
})

test('화면 — 사람이 넣은 글자는 이스케이프', () => {
  const evil = competition({ name: EVIL, place: EVIL, note: EVIL })
  const member1 = member('m1', EVIL)
  const mine = competitionHtml({ competition: evil, entry: entry('m1', [free50], true, EVIL), today: '2026-11-19', saved: false, error: null })
  expect(mine).not.toContain('<img src=x')
  expect(mine).toContain('value="free-50" checked')
  expect(mine).toContain('name="relay" value="yes" checked')
  expect(mine).toContain('data-action="delete-entry"')
  const closed = competitionHtml({ competition: evil, entry: null, today: '2026-12-10', saved: false, error: null })
  expect(closed).toContain('마감')
  expect(closed).not.toContain('id="entry-form"')
  const admin = adminCompetitionHtml({ competition: evil, entries: [entry('m1', [free50], true, EVIL)], members: [member1], today: '2026-11-19', saved: false, error: null })
  expect(admin).not.toContain('<img src=x')
  expect(admin).toContain('신청 1명 · 단체전 가능 1명')
  expect(admin).toContain('href="#/admin/relay?c=c1"')
})

describe('대회 종목 — 운영자가 적는 거리 · 핀', () => {
  const fin50 = { stroke: 'free' as const, distance: 50, fins: true }
  const back200 = { stroke: 'back' as const, distance: 200, fins: false }

  test('키 · 이름 — 예전 키(free-50)와 그대로 맞는다', () => {
    expect(competitionEventKey(free50)).toBe('free-50')
    expect(competitionEventKey(fin50)).toBe('free-50-fin')
    expect(parseCompetitionEventKey('free-50')).toEqual(free50)
    expect(parseCompetitionEventKey('back-200')).toEqual(back200)
    expect(parseCompetitionEventKey('free-50-fin')).toEqual(fin50)
    expect(competitionEventLabel(fin50)).toBe('핀 자유형 50m')
    expect(competitionEventLabel(back200)).toBe('배영 200m')
    for (const bad of ['free-5', 'free-05', 'swim-50', 'free-50-fins', 'free-9999', '']) expect(parseCompetitionEventKey(bad)).toBeNull()
  })

  test('순서 — 영법, 핀 아닌 것 먼저, 짧은 거리', () => {
    expect(sortEvents([fin50, back200, free100, back50, free50]).map(competitionEventKey)).toEqual([
      'free-50',
      'free-100',
      'free-50-fin',
      'back-50',
      'back-200',
    ])
  })

  test('운영자 입력 — 거리 범위 · 겹침', () => {
    const input = { ...competition(), id: undefined }
    expect(competitionProblem({ ...input, events: [back200, fin50] })).toBeNull()
    expect(competitionProblem({ ...input, events: [{ ...back200, distance: 5 }] })).toContain('거리')
    expect(competitionProblem({ ...input, events: [free50, { ...free50 }] })).toContain('두 번')
  })

  test('회원은 핀 종목도 고른다 · 핀 아닌 같은 거리와는 다른 종목', () => {
    const c = competition({ events: [free50, fin50] })
    expect(entryProblem(c, [fin50], false, '2026-11-19')).toBeNull()
    expect(entryProblem(competition(), [fin50], false, '2026-11-19')).toContain('핀 자유형 50m은 이 대회 종목이 아닙니다')
  })

  test('대회 화면 — 기본 13종목 + 이 대회에만 있는 종목, 추가 칸', () => {
    const html = adminCompetitionsHtml({ today: '2026-11-19', competitions: [], notice: null, error: null })
    expect(html).toContain('data-action="add-comp-event"')
    expect(html).toContain('data-add="fins"')
    expect(html).toContain('<option value="im">개인혼영</option>')
    expect(eventCheckHtml(fin50, true)).toContain('value="free-50-fin" checked')
    const edit = adminCompetitionHtml({ competition: competition({ events: [free50, back200] }), entries: [], members: [], today: '2026-11-19', saved: false, error: null })
    expect(edit).toContain('value="back-200" checked')
    expect(edit).toContain('value="free-50" checked')
    expect(edit).toContain('value="free-25" />')
  })
})
