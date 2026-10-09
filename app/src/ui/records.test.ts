import { describe, expect, test } from 'bun:test'
import { prescribe } from '../core/sets'
import type { Meeting, Member, SwimRecord } from '../core/types'
import { recordChartHtml } from './chart'
import { adminRecordsHtml, recordFormHtml, recordsHtml } from './records'
import { adminSetsHtml, readPlanForm, setsHtml } from './sets'
import { formulaPlanAt } from '../core/sets'

const EVIL = '<img src=x onerror=alert(1)>'
const FREE50 = { stroke: 'free', distance: 50 } as const
const FREE100 = { stroke: 'free', distance: 100 } as const

const rec = (id: string, date: string, timeCs: number, extra: Partial<SwimRecord> = {}): SwimRecord => ({
  id,
  memberId: 'm1',
  ...FREE50,
  timeCs,
  date,
  source: 'self',
  meetingId: null,
  note: '',
  ...extra,
})

const meeting: Meeting = {
  id: 'mt1',
  date: '2026-09-27',
  kind: 'record',
  label: '',
  place: EVIL,
  cancelled: false,
  checkedAt: '2026-09-27T22:00:00Z',
}

const member = (id: string, displayName: string): Member => ({
  id,
  displayName,
  role: 'member',
  status: 'active',
  joinedOn: '2026-01-01',
  sex: null,
  birthYear: null,
  naverLinked: false,
})

describe('나의 기록', () => {
  const records = [
    rec('a', '2026-08-01', 3400, { note: EVIL }),
    rec('b', '2026-09-27', 3310, { source: 'meeting', meetingId: 'mt1' }),
  ]
  const html = recordsHtml({
    event: FREE50,
    events: [FREE50],
    counts: new Map([['free-50', 2]]),
    period: 'all',
    records,
    best: records[1]!,
    standing: { topPercent: 23, sampleSize: 1234, group: '남자 40대' },
    pbIds: new Set(['a', 'b']),
    goalCs: 3200,
    meetings: new Map([['mt1', meeting]]),
    saved: false,
    error: null,
  })

  test('메모 · 장소는 이스케이프', () => {
    expect(html).not.toContain('<img src=x')
  })

  test('최고기록 · 목표까지 · 차트 · 출처', () => {
    expect(html).toContain('33.10')
    expect(html).toContain('목표 32.00까지 1.10초')
    expect(html).toContain('<svg')
    expect(html).toContain('c-dot c-meeting')
    expect(html).toContain('c-dot c-self')
    expect(html).toContain('남자 40대 기준 <strong>상위 23%</strong>')
    expect(html).toContain('1,234건')
  })

  test('개인 입력만 고치기 링크가 있다', () => {
    expect(html).toContain('href="#/records/edit?id=a"')
    expect(html).not.toContain('href="#/records/edit?id=b"')
  })

  test('기록이 없으면 넣기 안내', () => {
    const empty = recordsHtml({
      event: null,
      events: [],
      counts: new Map(),
      period: 'all',
      records: [],
      best: null,
      standing: null,
      pbIds: new Set(),
      goalCs: null,
      meetings: new Map(),
      saved: false,
      error: null,
    })
    expect(empty).toContain('아직 기록이 없습니다')
    expect(empty).toContain('href="#/records/new"')
  })
})

test('차트 — 점이 하나면 그리지 않고, 목표선은 가까울 때만', () => {
  expect(recordChartHtml([{ date: '2026-01-01', timeCs: 3400, source: 'self', pb: true }], null)).not.toContain('<svg')
  const points = [
    { date: '2026-01-01', timeCs: 3400, source: 'self' as const, pb: true },
    { date: '2026-02-01', timeCs: 3300, source: 'meeting' as const, pb: true },
  ]
  expect(recordChartHtml(points, 3200)).toContain('c-goal')
  expect(recordChartHtml(points, 1000)).not.toContain('c-goal')
})

describe('기록 넣기', () => {
  test('50m 는 분 칸을 숨기고, 100m 는 보인다', () => {
    const base = { editing: null, date: '2026-10-08', timeCs: null, note: '', today: '2026-10-08', error: null }
    expect(recordFormHtml({ ...base, event: FREE50 })).toMatch(/class="time-part min-part" hidden/)
    expect(recordFormHtml({ ...base, event: FREE100 })).not.toMatch(/min-part" hidden/)
  })

  test('고치기는 값을 되살리고 지우기 버튼이 있다', () => {
    const editing = rec('a', '2026-08-01', 6530, { note: EVIL })
    const html = recordFormHtml({
      editing,
      event: FREE50,
      date: editing.date,
      timeCs: editing.timeCs,
      note: editing.note,
      today: '2026-10-08',
      error: null,
    })
    expect(html).toContain('value="65.30"')
    expect(html).toContain('data-action="delete-record"')
    expect(html).not.toContain('<img src=x')
  })
})

test('운영자 모임 기록 — 이름 이스케이프, 저장된 값, 결석 표시', () => {
  const html = adminRecordsHtml({
    meetings: [meeting],
    selected: meeting,
    event: FREE50,
    roster: [member('m1', EVIL), member('m2', '김철수')],
    present: new Set(['m1']),
    values: new Map([['m1', { minutes: '', seconds: '33.10' }]]),
    saved: false,
    error: null,
  })
  expect(html).not.toContain('<img src=x')
  expect(html).toContain('name="s-m1"')
  expect(html).toContain('value="33.10"')
  expect(html).toContain('결석')
  expect(html).not.toContain('name="m-m1"') // 50m 는 분 칸 없음
  expect(html).toMatch(/id="filled-count">1</)
})

describe('세트', () => {
  const best = rec('b', '2026-09-27', 3240)

  test('기록이 없으면 넣으라고 한다', () => {
    const html = setsHtml({ event: FREE50, best: null, goalCs: null, prescription: null, error: null })
    expect(html).toContain('href="#/records/new?e=free-50"')
  })

  test('처방 — 단계, 출처 표시, 근거', () => {
    const html = setsHtml({
      event: FREE50,
      best,
      goalCs: 3100,
      prescription: prescribe(FREE50, 3240, 3100, []),
      error: null,
    })
    expect(html).toContain('1.40')
    expect(html).toContain('1단계 · 32.40 → 31.40')
    expect(html).toContain('2단계 · 31.40 → 31.00')
    expect(html).toContain('공식 기본값')
    expect(html).toContain('다이빙 이득 0.70초')
    expect(html).toContain('16.05')
    // 내부 등급 이름은 회원에게 보이지 않는다(PRD-0001 §5).
    expect(html).not.toMatch(/초급|중급|고급|최상급/)
  })

  test('목표가 없으면 1초 단축으로 보여준다고 밝힌다', () => {
    const html = setsHtml({ event: FREE50, best, goalCs: null, prescription: prescribe(FREE50, 3240, 3140, []), error: null })
    expect(html).toContain('1초 단축으로 보여줍니다')
  })

  test('코치 화면 — 밑그림을 폼에 채우고 그대로 읽어 돌린다', () => {
    const plan = formulaPlanAt(FREE100, 3, 'intermediate')
    const html = adminSetsHtml({
      event: FREE100,
      bracket: 3,
      plan,
      overriddenAt: null,
      overridden: new Set([1]),
      saved: false,
      error: null,
    })
    expect(html).toContain('공식 기본값')
    expect(html).toContain('value="브로큰 스윔"')
    expect(html).toContain('<option value="faster" selected>')

    // 폼 값을 흉내 내 읽는다.
    const values = new Map<string, string>()
    for (const m of html.matchAll(/name="([^"]+)"[^>]*value="([^"]*)"/g)) values.set(m[1]!, m[2]!)
    for (const m of html.matchAll(/<select id="[^"]+" name="([^"]+)">[\s\S]*?<option value="([^"]+)" selected>/g)) {
      values.set(m[1]!, m[2]!)
    }
    expect(readPlanForm((name) => values.get(name) ?? '')).toEqual(plan)
  })
})

test('운영자 기록 화면에 엑셀 내려받기 — 모임이 없어도', () => {
  const empty = adminRecordsHtml({
    meetings: [],
    selected: null,
    event: FREE50,
    roster: [],
    present: new Set(),
    values: new Map(),
    saved: false,
    error: null,
  })
  expect(empty).toContain('data-action="download-records"')
})
