import { describe, expect, test } from 'bun:test'
import { monthHistory, monthSummary } from '../core/attendance'
import type { Meeting, Member } from '../core/types'
import {
  accountHtml,
  adminMemberHtml,
  passwordMessage,
  adminAttendanceHtml,
  adminMeetingHtml,
  adminMeetingsHtml,
  adminMembersHtml,
  naverDemoHtml,
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
  naverLinked: false,
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
      upcoming: [meeting('2026-10-30', { place: EVIL, checkedAt: null })],
      selected: meeting('2026-10-30', { place: EVIL, checkedAt: null }),
      rsvps: new Map(),
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
      rsvps: new Map(),
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
      requests: [],
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
      requests: [],
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
    expect(loginHtml({ mode: 'login', error: EVIL, name: EVIL, demoAccounts: null, naver: null, notice: EVIL })).not.toContain('<img src=x')
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
    rsvps: new Map(),
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
      requests: [],
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
    const html = adminMeetingsHtml({ today: TODAY, meetings: [meeting('2026-10-25', { kind: 'record' })], customLabels: [], answers: new Map(), notice: null, error: null })
    expect(html).toContain('자수모임')
    expect(html).not.toContain('기록회')
    expect(html).toContain('<option value="custom">직접 입력…</option>')
    expect(html).toContain('class="field custom-label-field" hidden')
  })

  test('직접 넣은 이름은 이스케이프되고, 종류 목록에 다시 나온다', () => {
    const custom = meeting('2026-10-25', { kind: 'custom', label: EVIL })
    const html = adminMeetingsHtml({ today: TODAY, meetings: [custom], customLabels: [EVIL], answers: new Map(), notice: null, error: null })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('value="custom:&lt;img')
    const home = homeHtml({
      member: member(),
      today: TODAY,
      month: monthSummary('2026-10', [], new Set(), '2026-01-01', TODAY),
      upcoming: [{ ...custom, date: '2026-10-30', checkedAt: null }],
      selected: { ...custom, date: '2026-10-30', checkedAt: null },
      rsvps: new Map(),
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
      rsvps: new Map(),
    })
    expect(attendance).not.toContain('<img src=x')
    expect(attendance).toContain('&lt;img src=x')
  })
})

describe('참석 여부', () => {
  const upcoming = [
    meeting('2026-10-28', { checkedAt: null }),
    meeting('2026-10-30', { checkedAt: null, kind: 'record', place: EVIL }),
  ]
  const home = (selected: Meeting, rsvps: Map<string, boolean>) =>
    homeHtml({
      member: member(),
      today: TODAY,
      month: monthSummary('2026-10', [], new Set(), '2026-01-01', TODAY),
      upcoming,
      selected,
      rsvps,
      pb: null,
      goal: null,
      tempPassword: false,
    })

  test('여러 개면 드롭다운, 고른 모임에 참석 · 불참 버튼', () => {
    const html = home(upcoming[1]!, new Map([['2026-10-28', true]]))
    expect(html).toContain('id="home-meeting" data-nav="home"')
    expect(html).toContain('<option value="2026-10-30" selected>')
    expect(html).toContain('10/28 수 · 정기 훈련 · 참석</option>')
    expect(html).toContain('다가오는 모임')
    expect(html).toContain('data-action="rsvp" data-id="2026-10-30" data-going="yes" aria-pressed="false"')
    expect(html).toContain('참석 여부를 알려 주세요')
    expect(html).not.toContain('<img src=x')
  })

  test('답한 버튼은 눌린 상태, 하나뿐이면 드롭다운이 없다', () => {
    const one = homeHtml({
      member: member(),
      today: TODAY,
      month: monthSummary('2026-10', [], new Set(), '2026-01-01', TODAY),
      upcoming: [upcoming[0]!],
      selected: upcoming[0]!,
      rsvps: new Map([['2026-10-28', false]]),
      pb: null,
      goal: null,
      tempPassword: false,
    })
    expect(one).not.toContain('id="home-meeting"')
    expect(one).toContain('10/28 수 · 오늘')
    expect(one).toContain('data-going="no" aria-pressed="true"')
    expect(one).toContain('불참으로 답했어요')
  })

  test('운영 출석 체크 — 미리 한 답과 참석 예정자 체크 버튼', () => {
    const html = adminAttendanceHtml({
      meetings: [meeting('2026-10-27')],
      selected: meeting('2026-10-27'),
      roster: [member(), member({ id: 'm2', displayName: '김철수' })],
      present: new Set(),
      rsvps: new Map([
        ['m1', true],
        ['m2', false],
      ]),
      saved: false,
      error: null,
    })
    expect(html).toContain('참석 예정')
    expect(html).toContain('불참 예정')
    expect(html).toContain('value="m1" data-going="yes"')
    expect(html).toContain('data-action="check-going"')
  })

  test('운영 모임 목록 — 예정 모임의 답 요약, 이름 이스케이프', () => {
    const html = adminMeetingsHtml({
      today: TODAY,
      meetings: [meeting('2026-10-30', { checkedAt: null }), meeting('2026-11-04', { checkedAt: null })],
      customLabels: [],
      answers: new Map([['2026-10-30', { going: [EVIL, '홍길동'], notGoing: ['김철수'] }]]),
      notice: null,
      error: null,
    })
    expect(html).toContain('참석 2 · 불참 1')
    expect(html.match(/rsvp-detail/g)).toHaveLength(1)
    expect(html).not.toContain('<img src=x')
  })

  test('출석 화면 — 예정 모임에 내 답', () => {
    const html = attendanceHtml({
      today: TODAY,
      summary: monthSummary('2026-10', [meeting('2026-10-30', { checkedAt: null })], new Set(), '2026-01-01', TODAY),
      history: [],
      prevMonth: '2026-09',
      nextMonth: null,
      rsvps: new Map([['2026-10-30', true]]),
    })
    expect(html).toContain('예정 · 참석')
  })
})

describe('모임 고치기 · 지우기', () => {
  test('목록에 수정 링크와 방금 한 일', () => {
    const html = adminMeetingsHtml({
      today: TODAY,
      meetings: [meeting('2026-10-30', { checkedAt: null })],
      customLabels: [],
      answers: new Map(),
      notice: '모임을 지웠습니다.',
      error: null,
    })
    expect(html).toContain('href="#/admin/meeting?id=2026-10-30"')
    expect(html).toContain('모임을 지웠습니다.')
  })

  test('고치기 화면 — 지금 값이 채워지고, 지우면 사라지는 것을 알린다', () => {
    const custom = meeting('2026-10-25', { kind: 'custom', label: EVIL, place: EVIL })
    const html = adminMeetingHtml({
      meeting: custom,
      today: TODAY,
      customLabels: ['바다수영'],
      attended: 7,
      records: 3,
      answers: 2,
      error: null,
    })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('value="2026-10-25"')
    // 최근 목록에 없는 이름도 골라져 있다.
    expect(html).toContain('<option value="custom:&lt;img src=x onerror=alert(1)&gt;" selected>')
    expect(html).toContain('출석 7명 · 참석 여부 답 2건이 함께 지워집니다. 회원 달성률이 바뀝니다.')
    expect(html).toContain('기록 3건은 회원 기록에 남고')
    expect(html).toContain('data-action="delete-meeting"')
  })

  test('정해 둔 종류는 그 값이 골라져 있다', () => {
    const html = adminMeetingHtml({
      meeting: meeting('2026-10-25', { kind: 'record' }),
      today: TODAY,
      customLabels: [],
      attended: 0,
      records: 0,
      answers: 0,
      error: null,
    })
    expect(html).toContain('<option value="record" selected>')
    expect(html).toContain('출석 · 기록 · 참석 여부 답이 없습니다')
  })
})

describe('네이버 로그인 화면', () => {
  const base = { mode: 'login' as const, error: null, name: '', demoAccounts: null, notice: null }

  test('Client ID 가 있으면 네이버 버튼, 없으면 없다', () => {
    expect(loginHtml({ ...base, naver: 'real' })).toContain('data-action="naver-login"')
    expect(loginHtml({ ...base, naver: 'demo' })).toContain('href="#/naver-demo"')
    expect(loginHtml({ ...base, naver: null })).not.toContain('naver-button')
  })

  test('가입 신청 안내', () => {
    expect(loginHtml({ ...base, naver: 'real', notice: '가입 신청을 보냈습니다' })).toContain('가입 신청을 보냈습니다')
  })

  test('데모 화면', () => {
    expect(naverDemoHtml(EVIL)).toContain('id="naver-demo-form"')
    expect(naverDemoHtml(EVIL)).not.toContain('<img src=x')
  })

  test('운영 — 가입 신청 카드: 새 회원 · 기존 회원 연결 · 거절, 비슷한 이름이 위로', () => {
    const html = adminMembersHtml({
      today: TODAY,
      members: [
        member({ id: 'z', displayName: '가나다' }),
        member({ id: 'k', displayName: '김민수A' }),
        member({ id: 'n', displayName: '네이버됨', naverLinked: true }),
      ],
      issued: [],
      bulk: null,
      appUrl: 'https://x.org/',
      requests: [{ id: 'r1', name: '김민수', nickname: EVIL, sex: 'M', birthYear: 1985, createdAt: '2026-10-09T01:00:00Z' }],
      error: null,
    })
    expect(html).toContain('네이버 가입 신청 1건')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('<option value="new">새 회원으로 추가</option>')
    expect(html.indexOf('value="k"')).toBeLessThan(html.indexOf('value="z"'))
    expect(html).not.toContain('<option value="n"') // 이미 네이버에 연결된 회원은 고를 수 없다
    expect(html).toContain('data-action="approve-request" data-id="r1"')
    expect(html).toContain('네이버됨</strong>')
    expect(html).toContain('사용 중 · 네이버')
  })

  test('회원 한 명 — 연결돼 있으면 끊기 버튼', () => {
    const html = adminMemberHtml({
      member: member({ naverLinked: true }),
      isSelf: false,
      issued: null,
      appUrl: 'https://x.org/',
      saved: false,
      error: null,
    })
    expect(html).toContain('data-action="unlink-naver"')
  })
})
