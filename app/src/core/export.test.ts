import { describe, expect, test } from 'bun:test'
import { exportFileName, recordSheets } from './export'
import type { Meeting, Member, SwimRecord } from './types'
import { buildXlsx, columnName, crc32, xmlText, zipStored } from './xlsx'

const member = (id: string, displayName: string, extra: Partial<Member> = {}): Member => ({
  id,
  displayName,
  role: 'member',
  status: 'active',
  joinedOn: '2026-01-01',
  sex: null,
  birthYear: null,
  ...extra,
})

const rec = (id: string, memberId: string, date: string, timeCs: number, extra: Partial<SwimRecord> = {}): SwimRecord => ({
  id,
  memberId,
  stroke: 'free',
  distance: 50,
  timeCs,
  date,
  source: 'self',
  meetingId: null,
  note: '',
  ...extra,
})

const meeting: Meeting = {
  id: 'mt',
  date: '2026-09-27',
  kind: 'record',
  label: '',
  place: '잠실',
  cancelled: false,
  checkedAt: null,
}

describe('기록 시트', () => {
  const members = [member('b', '김철수', { sex: 'M', birthYear: 1980 }), member('a', '가나다')]
  const records = [
    rec('1', 'b', '2026-08-01', 3400),
    rec('2', 'b', '2026-09-27', 3310, { source: 'meeting', meetingId: 'mt' }),
    rec('3', 'b', '2026-10-01', 3350, { note: '혼자' }),
    rec('4', 'a', '2026-10-02', 6530, { distance: 100, stroke: 'back' }),
    rec('5', 'a', '2026-10-03', 3000), // 김철수보다 빠르지만 김철수의 PB 에 영향이 없어야 한다
  ]
  const [all, bests] = recordSheets(members, records, [meeting])

  test('전체 기록 — 이름 · 종목 · 날짜 순, 숫자 초, 출처, 모임 이름, 회원별 PB', () => {
    expect(all!.rows[0]).toEqual(['이름', '날짜', '영법', '거리(m)', '기록', '기록(초)', '출처', '모임', '메모', 'PB'])
    expect(all!.rows.slice(1).map((r) => [r[0], r[1], r[4], r[9]])).toEqual([
      ['가나다', '2026-10-03', '30.00', 'PB'],
      ['가나다', '2026-10-02', '1:05.30', 'PB'],
      ['김철수', '2026-08-01', '34.00', 'PB'],
      ['김철수', '2026-09-27', '33.10', 'PB'],
      ['김철수', '2026-10-01', '33.50', ''],
    ])
    const official = all!.rows[4]!
    expect(official[5]).toBe(33.1)
    expect(official[6]).toBe('모임 기록')
    expect(official[7]).toBe('2026-09-27 자수모임 · 잠실')
    expect(all!.rows[5]![8]).toBe('혼자')
  })

  test('회원별 최고기록 — 회원 × 종목 한 줄', () => {
    expect(bests!.rows.slice(1)).toEqual([
      ['가나다', '', null, '자유형', 50, '30.00', 30, '2026-10-03', 1],
      ['가나다', '', null, '배영', 100, '1:05.30', 65.3, '2026-10-02', 1],
      ['김철수', '남', 1980, '자유형', 50, '33.10', 33.1, '2026-09-27', 3],
    ])
  })

  test('파일 이름', () => {
    expect(exportFileName('2026-10-08')).toBe('나인틴_기록_2026-10-08.xlsx')
  })
})

describe('xlsx', () => {
  test('열 이름', () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA'])
  })

  test('XML 글자 — 이스케이프하고 쓸 수 없는 제어 문자는 지운다', () => {
    expect(xmlText(`<a href="x">&\u0001\u0007ok\tline\n</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;ok\tline\n&lt;/a&gt;')
  })

  test('CRC32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  test('zip 구조 — 로컬 헤더, 중앙 디렉터리, 끝 레코드', () => {
    const zip = zipStored([['a.txt', new TextEncoder().encode('hi')]])
    const view = new DataView(zip.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50)
    expect(view.getUint16(zip.length - 22 + 10, true)).toBe(1)
  })

  test('엑셀 파일 — 시트가 들어 있고 사람이 넣은 글자는 이스케이프된다', () => {
    const bytes = buildXlsx([{ name: '전체 기록', widths: [10], rows: [['이름'], ['<b>&'], [32.4]] }])
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('xl/worksheets/sheet1.xml')
    expect(text).toContain('<sheet name="전체 기록"')
    expect(text).toContain('&lt;b&gt;&amp;')
    expect(text).toContain('<v>32.4</v>')
    expect(text).not.toContain('<b>&')
  })
})
