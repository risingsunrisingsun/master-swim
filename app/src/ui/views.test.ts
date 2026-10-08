import { describe, expect, test } from 'bun:test'
import { monthHistory, monthSummary } from '../core/attendance'
import type { Meeting, Member } from '../core/types'
import {
  accountHtml,
  adminMemberHtml,
  passwordMessage,
  adminAttendanceHtml,
  adminMeetingsHtml,
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
  sex: null,
  birthYear: null,
  ...extra,
})

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
      pb: null,
      goal: null,
      tempPassword: true,
    })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('href="#/account"')
    expect(html).toContain('비밀번호를 바꿔 주세요')
  })

  test('내 계정', () => {
    const html = accountHtml({ member: member({ displayName: EVIL }), saved: true, error: EVIL })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('id="password-form"')
    expect(html).toContain('autocomplete="current-password"')
    expect(html).toContain('비밀번호를 바꿨습니다')
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
      issued: [{ kind: 'invite', member: evil, code: 'TEAM2345', expiresOn: '2026-11-04' }],
      bulk: null,
      appUrl: 'https://example.org/',
      error: null,
    })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('TEAM-2345')
  })

  test('일괄 추가 — 코드 목록과 막힌 명단', () => {
    const evil = member({ displayName: EVIL })
    const html = adminMembersHtml({
      today: TODAY,
      members: [evil],
      issued: [
        { kind: 'invite', member: evil, code: 'TEAM2345', expiresOn: '2026-11-04' },
        { member: member({ displayName: '김철수' }), kind: 'invite', code: 'SWIM6789', expiresOn: '2026-11-04' },
        { member: member({ displayName: '이영희' }), kind: 'password', password: 'pw<b>123' },
      ],
      bulk: { text: EVIL, joinedOn: TODAY, problems: [{ line: 1, name: EVIL, reason: '이미 등록된 이름입니다' }] },
      appUrl: 'https://example.org/',
      error: null,
    })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('3명 추가')
    expect(html).toContain('비밀번호로 바로 로그인')
    expect(html).toContain('비밀번호 pw&lt;b&gt;123 로 로그인')
    expect(html).not.toContain('pw<b>')
    expect(html).toContain('TEAM-2345')
    expect(html).toContain('SWIM-6789')
    expect(html).toContain('1째 줄')
    // 막혔으면 접힌 칸을 열어 둔다.
    expect(html).toContain('<details class="card" open>')
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

describe('회원 정보 · 비밀번호', () => {
  test('비밀번호 문구', () => {
    expect(passwordMessage('홍길동', 'swim1234', 'https://x.org/')).toContain("이름 '홍길동', 비밀번호 swim1234 로 로그인")
  })

  test('명단에 성별 · 출생연도, 회원 화면 링크', () => {
    const html = adminMembersHtml({
      today: TODAY,
      members: [member({ sex: 'F', birthYear: 1985 }), member({ id: 'm2', status: 'invited' })],
      issued: [],
      bulk: null,
      appUrl: 'https://x.org/',
      error: null,
    })
    expect(html).toContain('여 · 1985년생')
    expect(html).toContain('href="#/admin/member?id=m1"')
    expect(html).toContain('id="member-password"')
    // 초대코드 버튼은 가입 전 회원에게만
    expect(html.match(/data-action="issue-invite"/g)).toHaveLength(1)
  })

  test('회원 한 명 화면 — 저장된 값, 이스케이프, 가입 전이면 계정 만들기', () => {
    const html = adminMemberHtml({
      member: member({ displayName: EVIL, status: 'invited', sex: 'M', birthYear: 1979 }),
      isSelf: false,
      issued: null,
      appUrl: 'https://x.org/',
      saved: false,
      error: null,
    })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('<option value="M" selected>')
    expect(html).toContain('value="1979"')
    expect(html).toContain('계정 만들기')
    expect(html).toContain('id="profile-name"')
    expect(html).toContain('<option value="member" selected>')
    expect(html).not.toContain('id="profile-role" name="role" disabled')
  })

  test('내 계정이면 역할을 못 바꾼다', () => {
    const html = adminMemberHtml({
      member: member({ role: 'admin' }),
      isSelf: true,
      issued: null,
      appUrl: 'https://x.org/',
      saved: false,
      error: null,
    })
    expect(html).toContain('id="profile-role" name="role" disabled')
    expect(html).toContain('<input type="hidden" name="role" value="admin" />')
  })
})

describe('모임 종류 — 자수모임 · 직접 입력', () => {
  test('기록회는 자수모임으로 보인다', () => {
    const html = adminMeetingsHtml({ today: TODAY, meetings: [meeting('2026-10-25', { kind: 'record' })], customLabels: [], error: null })
    expect(html).toContain('자수모임')
    expect(html).not.toContain('기록회')
    expect(html).toContain('<option value="custom">직접 입력…</option>')
    expect(html).toContain('class="field custom-label-field" hidden')
  })

  test('직접 넣은 이름은 이스케이프되고, 종류 목록에 다시 나온다', () => {
    const custom = meeting('2026-10-25', { kind: 'custom', label: EVIL })
    const html = adminMeetingsHtml({ today: TODAY, meetings: [custom], customLabels: [EVIL], error: null })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('value="custom:&lt;img')
    const home = homeHtml({
      member: member(),
      today: TODAY,
      month: monthSummary('2026-10', [], new Set(), '2026-01-01', TODAY),
      next: { ...custom, date: '2026-10-30', checkedAt: null },
      pb: null,
      goal: null,
      tempPassword: false,
    })
    expect(home).not.toContain('<img src=x')
    const attendance = attendanceHtml({
      today: TODAY,
      summary: monthSummary('2026-10', [custom], new Set(), '2026-01-01', TODAY),
      history: [],
      prevMonth: '2026-09',
      nextMonth: null,
    })
    expect(attendance).not.toContain('<img src=x')
    expect(attendance).toContain('&lt;img src=x')
  })
})
