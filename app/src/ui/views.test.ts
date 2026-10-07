import { describe, expect, test } from 'bun:test'
import { monthHistory, monthSummary } from '../core/attendance'
import type { Meeting, Member } from '../core/types'
import {
  adminAttendanceHtml,
  adminMembersHtml,
  attendanceHtml,
  esc,
  homeHtml,
  inviteMessage,
  loginHtml,
  ringHtml,
  tabbarHtml,
} from './views'

const EVIL = '<img src=x onerror=alert(1)>'

const member = (extra: Partial<Member> = {}): Member => ({
  id: 'm1',
  displayName: '홍길동',
  role: 'member',
  status: 'active',
  joinedOn: '2026-01-01',
  ...extra,
})

const meeting = (date: string, extra: Partial<Meeting> = {}): Meeting => ({
  id: date,
  date,
  kind: 'training',
  place: '',
  cancelled: false,
  checkedAt: `${date}T22:00:00Z`,
  ...extra,
})

const TODAY = '2026-10-28'

test('esc', () => {
  expect(esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
})

describe('사람이 넣은 글자는 이스케이프된다', () => {
  test('홈 · 이름과 장소', () => {
    const html = homeHtml({
      member: member({ displayName: EVIL }),
      today: TODAY,
      month: monthSummary('2026-10', [], new Set(), '2026-01-01', TODAY),
      next: meeting('2026-10-30', { place: EVIL, checkedAt: null }),
    })
    expect(html).not.toContain('<img src=x')
  })

  test('출석 체크 명단', () => {
    const html = adminAttendanceHtml({
      meetings: [meeting('2026-10-27')],
      selected: meeting('2026-10-27'),
      roster: [member({ displayName: EVIL })],
      present: new Set(),
      saved: false,
      error: null,
    })
    expect(html).not.toContain('<img src=x')
  })

  test('회원 명단과 초대 문구', () => {
    const evil = member({ displayName: EVIL })
    const html = adminMembersHtml({
      today: TODAY,
      members: [evil],
      issued: { member: evil, code: 'TEAM2345', expiresOn: '2026-11-04' },
      appUrl: 'https://example.org/',
      error: null,
    })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('TEAM-2345')
  })

  test('로그인 이름 되살리기', () => {
    expect(loginHtml({ mode: 'login', error: EVIL, name: EVIL, demoAccounts: null })).not.toContain('<img src=x')
  })
})

test('탭은 운영자에게만 다섯 개', () => {
  expect(tabbarHtml('home', false).match(/<a /g)).toHaveLength(4)
  expect(tabbarHtml('home', true).match(/<a /g)).toHaveLength(5)
  expect(tabbarHtml('attendance', false)).toContain('href="#/attendance" aria-current="page"')
})

test('링은 rate 가 없으면 대시', () => {
  expect(ringHtml(null)).toContain('>—<')
  expect(ringHtml(0.75)).toContain('>75<')
})

describe('출석 화면', () => {
  const meetings = [
    meeting('2026-10-02'),
    meeting('2026-10-07'),
    meeting('2026-10-21', { cancelled: true }),
    meeting('2026-10-27', { checkedAt: null }),
    meeting('2026-10-30', { checkedAt: null }),
  ]
  const present = new Set(['2026-10-02'])
  const html = attendanceHtml({
    today: TODAY,
    summary: monthSummary('2026-10', meetings, present, '2026-01-01', TODAY),
    history: monthHistory('2026-10', 6, meetings, present, '2026-01-01', TODAY),
    prevMonth: '2026-09',
    nextMonth: null,
  })

  test('사실 문장', () => {
    expect(html).toContain('2회 중 1회 참석')
    expect(html).toContain('취소된 모임 1회는 빼고')
    expect(html).toContain('집계 전인 모임 1회')
    expect(html).toContain('다 나오면 67%')
  })

  test('이번 달이면 다음 달로 못 넘긴다', () => {
    expect(html).not.toContain('aria-label="다음 달"')
    expect(html).toContain('href="#/attendance?m=2026-09"')
  })

  test('막대 그래프에 대체 문구가 있다', () => {
    expect(html).toContain('aria-label="최근 6개월 달성률: 5월 없음')
    expect(html).toContain('10월 50%')
  })
})

test('초대 문구', () => {
  expect(inviteMessage('홍길동', 'TEAM2345', '2026-11-04', 'https://x.org/')).toBe(
    "[나인틴] 홍길동 님 초대코드: TEAM-2345\n11/4 수까지 쓸 수 있어요.\nhttps://x.org/ 에서 '초대코드로 가입'을 누르세요.",
  )
})
