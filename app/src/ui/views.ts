/**
 * 화면 HTML 생성. 순수 함수라 브라우저 없이 테스트된다(v1 view.ts 와 같은 방식).
 *
 * 사람이 넣은 글자(이름 · 장소)는 전부 `esc` 를 거친다. 운영자가 넣은 이름이
 * 다른 회원 화면에 뜨므로, 빠뜨리면 한 사람이 모두의 화면에 스크립트를 심을 수 있다.
 */
import { type MeetingRow, type MeetingStatus, type MonthSummary, percent } from '../core/attendance'
import { longDateLabel, monthLabel, shortDateLabel } from '../core/dates'
import { formatCode } from '../core/invite'
import { type Meeting, MEETING_KIND_LABEL, type Member } from '../core/types'

export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── 공통 ─────────────────────────────────────────────────────

export type Tab = 'home' | 'sets' | 'records' | 'attendance' | 'admin'

const ICONS: Record<Tab, string> = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  sets: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  records: '<path d="M3 3v18h18M7 14l4-4 3 3 5-6"/>',
  attendance: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>',
  admin: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
}

const TAB_LABEL: Record<Tab, string> = {
  home: '홈',
  sets: '세트',
  records: '기록',
  attendance: '출석',
  admin: '운영',
}

export function icon(paths: string, size = 24): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`
}

/** 하단 탭. 운영자에게만 다섯 번째 칸이 생긴다. */
export function tabbarHtml(active: Tab, isAdmin: boolean): string {
  const tabs: Tab[] = isAdmin ? ['home', 'sets', 'records', 'attendance', 'admin'] : ['home', 'sets', 'records', 'attendance']
  const items = tabs
    .map((tab) => {
      const current = tab === active ? ' aria-current="page"' : ''
      return `<a href="#/${tab}"${current}>${icon(ICONS[tab])}<span>${TAB_LABEL[tab]}</span></a>`
    })
    .join('')
  return `<nav class="tabbar" aria-label="주 메뉴" style="--tabs:${tabs.length}">${items}</nav>`
}

export function demoBannerHtml(): string {
  return `<div class="demo-banner" role="note">데모 모드 · 이 기기에만 저장됩니다. 실제 회원 정보를 넣지 마세요.</div>`
}

export function errorHtml(message: string | null): string {
  return message ? `<p class="form-error" role="alert">${esc(message)}</p>` : ''
}

// ── 로그인 ───────────────────────────────────────────────────

export type LoginMode = 'login' | 'join'

export interface LoginView {
  mode: LoginMode
  error: string | null
  /** 데모 모드에서 계정 안내를 띄운다. */
  demoAccounts: { admin: string; member: string; password: string; invite: string } | null
  /** 직전에 쓴 이름. 비밀번호가 틀렸을 때 이름을 다시 치지 않게. */
  name: string
}

export function loginHtml(view: LoginView): string {
  const tab = (mode: LoginMode, label: string) =>
    `<a href="#/${mode === 'login' ? 'login' : 'join'}" class="segment${view.mode === mode ? ' is-on' : ''}"${view.mode === mode ? ' aria-current="page"' : ''}>${label}</a>`

  const form =
    view.mode === 'login'
      ? `<form id="login-form" class="stack" novalidate>
          <div class="field">
            <label for="login-name">이름</label>
            <input id="login-name" name="name" autocomplete="username" required value="${esc(view.name)}" placeholder="운영자가 등록한 이름" />
          </div>
          <div class="field">
            <label for="login-password">비밀번호</label>
            <input id="login-password" name="password" type="password" autocomplete="current-password" required />
          </div>
          ${errorHtml(view.error)}
          <button class="button primary" type="submit">들어가기</button>
        </form>`
      : `<form id="join-form" class="stack" novalidate>
          <div class="field">
            <label for="join-code">초대코드</label>
            <input id="join-code" name="code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" required placeholder="ABCD-EFGH" class="code-input" />
          </div>
          <div class="field">
            <label for="join-password">새 비밀번호 <span class="muted">(6자 이상)</span></label>
            <input id="join-password" name="password" type="password" autocomplete="new-password" required />
          </div>
          <div class="field">
            <label for="join-confirm">비밀번호 확인</label>
            <input id="join-confirm" name="confirm" type="password" autocomplete="new-password" required />
          </div>
          ${errorHtml(view.error)}
          <button class="button primary" type="submit">가입하고 들어가기</button>
          <p class="hint">비밀번호를 잊었을 때도 운영자에게 새 초대코드를 받아 여기서 다시 정합니다.</p>
        </form>`

  const demo = view.demoAccounts
    ? `<div class="demo-accounts">
        <strong>데모 계정</strong>
        <span>운영자: ${esc(view.demoAccounts.admin)} / ${esc(view.demoAccounts.password)}</span>
        <span>회원: ${esc(view.demoAccounts.member)} / ${esc(view.demoAccounts.password)}</span>
        <span>가입 시험용 초대코드: ${formatCode(view.demoAccounts.invite)}</span>
      </div>`
    : ''

  return `<section class="login">
    <div class="brand">
      <img src="./mark.png" alt="" width="88" height="88" />
      <h1 class="wordmark">NINETEEN</h1>
      <p class="muted">회원 전용 · 내 기록과 출석</p>
    </div>
    <div class="segmented" role="tablist">${tab('login', '로그인')}${tab('join', '초대코드로 가입')}</div>
    ${form}
    ${demo}
    <p class="hint center">나인틴 카페 회원만 가입할 수 있습니다.<br />비밀번호를 잊었나요? 운영자에게 새 초대코드를 받으세요.</p>
  </section>`
}

// ── 홈 ───────────────────────────────────────────────────────

export interface HomeView {
  member: Member
  today: string
  month: MonthSummary
  next: Meeting | null
}

export function homeHtml(view: HomeView): string {
  const { month } = view
  const counted = [...month.rows].reverse().filter((row) => row.status === 'present' || row.status === 'absent')
  const dots = counted
    .map((row) => `<span class="dot${row.status === 'present' ? ' is-on' : ''}"></span>`)
    .join('')

  const rate =
    month.rate === null
      ? `<p class="hero-empty">이번 달에 집계된 모임이 아직 없어요.</p>`
      : `<p class="hero-number"><span class="num">${percent(month.rate)}</span><span class="unit">%</span></p>
         <div class="dots" style="--n:${Math.max(counted.length, 1)}" aria-hidden="true">${dots}</div>`

  const next = view.next
    ? `<span class="big">${shortDateLabel(view.next.date)}</span>
       <span class="muted small">${MEETING_KIND_LABEL[view.next.kind]}${view.next.place ? ` · ${esc(view.next.place)}` : ''}</span>`
    : `<span class="muted">예정된 모임이 없습니다.</span>`

  return `<header class="page-head row">
      <div>
        <p class="muted small">${longDateLabel(view.today)}</p>
        <h1>${esc(view.member.displayName)} 님</h1>
      </div>
      <img src="./mark.png" alt="나인틴" width="40" height="40" />
    </header>
    <div class="page-body">
      <a class="card hero" href="#/attendance">
        <div class="row baseline">
          <h2>${monthLabel(month.month)} 훈련 참여</h2>
          <span class="small">${month.counted > 0 ? `${month.counted}회 중 ${month.attended}회` : ''}</span>
        </div>
        ${rate}
      </a>
      <section class="card">
        <h2 class="muted small">다음 정기모임</h2>
        ${next}
      </section>
      <section class="card soft">
        <p class="small muted">기록 추이와 단축 세트는 다음 업데이트에서 열립니다.</p>
      </section>
      <button type="button" class="button quiet" data-action="sign-out">로그아웃</button>
    </div>`
}

// ── 출석 (기능3) ──────────────────────────────────────────────

export interface AttendanceView {
  today: string
  summary: MonthSummary
  history: MonthSummary[]
  prevMonth: string
  /** 미래 달로는 넘기지 않는다. */
  nextMonth: string | null
}

const RING_R = 54
const RING_C = 2 * Math.PI * RING_R

export function ringHtml(rate: number | null): string {
  const filled = rate === null ? 0 : RING_C * rate
  const label = rate === null ? '—' : String(percent(rate))
  return `<div class="ring">
    <svg width="128" height="128" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <circle cx="64" cy="64" r="${RING_R}" class="ring-track" />
      <circle cx="64" cy="64" r="${RING_R}" class="ring-fill" stroke-dasharray="${filled.toFixed(1)} ${RING_C.toFixed(1)}" transform="rotate(-90 64 64)" />
    </svg>
    <div class="ring-label"><span class="num">${label}</span>${rate === null ? '' : '<span class="unit">%</span>'}</div>
  </div>`
}

const STATUS_LABEL: Record<MeetingStatus, string> = {
  present: '참석',
  absent: '결석',
  cancelled: '제외',
  'before-join': '제외',
  upcoming: '예정',
  unchecked: '집계 전',
}

function rowNote(row: MeetingRow): string {
  const kind = MEETING_KIND_LABEL[row.meeting.kind]
  if (row.status === 'cancelled') return `${kind} · 취소`
  if (row.status === 'before-join') return `${kind} · 가입 전`
  return kind
}

export function attendanceHtml(view: AttendanceView): string {
  const { summary } = view
  const excluded = summary.rows.filter((row) => row.status === 'cancelled').length
  const unchecked = summary.rows.filter((row) => row.status === 'unchecked').length

  const facts = [
    summary.counted > 0 ? `<p class="lead">${summary.counted}회 중 ${summary.attended}회 참석</p>` : `<p class="lead">집계된 모임이 없습니다</p>`,
    excluded > 0 ? `<p class="small muted">취소된 모임 ${excluded}회는 빼고 셌어요</p>` : '',
    unchecked > 0 ? `<p class="small muted">출석 집계 전인 모임 ${unchecked}회가 있어요</p>` : '',
    summary.best !== null ? `<p class="small muted">남은 모임 ${summary.upcoming}회 · 다 나오면 ${percent(summary.best)}%</p>` : '',
  ].join('')

  const label = view.history
    .map((m) => `${monthLabel(m.month, view.today)} ${m.rate === null ? '없음' : `${percent(m.rate)}%`}`)
    .join(', ')
  const bars = view.history
    .map((m) => {
      const current = m.month === summary.month
      const height = m.rate === null ? 0 : Math.round(m.rate * 80)
      return `<div class="bar${current ? ' is-current' : ''}">
        <span class="bar-value">${m.rate === null ? '–' : `${percent(m.rate)}%`}</span>
        <span class="bar-fill" style="height:${height}px"></span>
        <span class="bar-label">${monthLabel(m.month)}</span>
      </div>`
    })
    .join('')

  const rows = summary.rows.length
    ? summary.rows
        .map(
          (row) => `<li class="list-row">
            <span class="list-date">${shortDateLabel(row.meeting.date)}</span>
            <span class="list-note">${rowNote(row)}</span>
            <span class="chip chip-${row.status}">${STATUS_LABEL[row.status]}</span>
          </li>`,
        )
        .join('')
    : `<li class="list-row muted">이 달에는 모임이 없습니다.</li>`

  const nextLink = view.nextMonth
    ? `<a class="icon-button" href="#/attendance?m=${view.nextMonth}" aria-label="다음 달">${icon('<path d="M9 6l6 6-6 6"/>', 20)}</a>`
    : `<span class="icon-button is-disabled" aria-hidden="true">${icon('<path d="M9 6l6 6-6 6"/>', 20)}</span>`

  return `<header class="page-head row">
      <h1>나인틴 훈련 참여</h1>
      <div class="month-nav">
        <a class="icon-button" href="#/attendance?m=${view.prevMonth}" aria-label="이전 달">${icon('<path d="M15 6l-6 6 6 6"/>', 20)}</a>
        <span class="month-label">${monthLabel(summary.month, view.today)}</span>
        ${nextLink}
      </div>
    </header>
    <div class="page-body">
      <section class="card row gap-l">
        ${ringHtml(summary.rate)}
        <div class="stack-s">${facts}</div>
      </section>
      <section class="card">
        <h2>월별 달성률</h2>
        <div class="bars" role="img" aria-label="최근 ${view.history.length}개월 달성률: ${label}" style="--n:${view.history.length}">${bars}</div>
      </section>
      <section class="card list-card">
        <ul class="list">${rows}</ul>
      </section>
    </div>`
}

export function comingSoonHtml(title: string, text: string): string {
  return `<header class="page-head"><h1>${esc(title)}</h1></header>
    <div class="page-body">
      <section class="card soft"><p>${esc(text)}</p></section>
    </div>`
}

// ── 운영자 ───────────────────────────────────────────────────

export type AdminTab = 'attendance' | 'meetings' | 'members'

const ADMIN_TABS: [AdminTab, string][] = [
  ['attendance', '출석'],
  ['meetings', '모임'],
  ['members', '회원'],
]

export function adminHeadHtml(active: AdminTab, title: string): string {
  const tabs = ADMIN_TABS.map(
    ([tab, label]) =>
      `<a href="#/admin/${tab}" class="segment${tab === active ? ' is-on' : ''}"${tab === active ? ' aria-current="page"' : ''}>${label}</a>`,
  ).join('')
  return `<header class="page-head admin-head">
    <p class="eyebrow">운영자</p>
    <h1>${esc(title)}</h1>
    <nav class="segmented" aria-label="운영 메뉴">${tabs}</nav>
  </header>`
}

export interface AdminAttendanceView {
  /** 고를 수 있는 모임(취소 제외), 최신이 위. */
  meetings: Meeting[]
  selected: Meeting | null
  roster: Member[]
  present: ReadonlySet<string>
  saved: boolean
  error: string | null
}

export function adminAttendanceHtml(view: AdminAttendanceView): string {
  const head = adminHeadHtml('attendance', '출석 체크')
  if (!view.selected) {
    return `${head}<div class="page-body"><section class="card soft"><p>체크할 모임이 없습니다. <a href="#/admin/meetings">모임을 먼저 만드세요.</a></p></section></div>`
  }

  const options = view.meetings
    .map((m) => {
      const state = m.checkedAt ? '' : ' · 집계 전'
      return `<option value="${m.id}"${m.id === view.selected?.id ? ' selected' : ''}>${shortDateLabel(m.date)} · ${MEETING_KIND_LABEL[m.kind]}${state}</option>`
    })
    .join('')

  const rows = view.roster
    .map(
      (member) => `<li><label class="check-row">
        <input type="checkbox" name="present" value="${member.id}"${view.present.has(member.id) ? ' checked' : ''} />
        <span>${esc(member.displayName)}</span>
        ${member.status === 'invited' ? '<span class="chip chip-unchecked">가입 전</span>' : ''}
      </label></li>`,
    )
    .join('')

  const status = view.saved
    ? `<p class="form-ok" role="status">저장했습니다.</p>`
    : view.selected.checkedAt
      ? `<p class="small muted">이미 저장된 모임입니다. 고쳐서 다시 저장할 수 있어요.</p>`
      : `<p class="small muted">아직 집계 전입니다. 저장해야 회원 달성률에 들어갑니다.</p>`

  return `${head}
    <form id="attendance-form" class="admin-form">
      <div class="page-body">
        <div class="field">
          <label for="meeting-select">모임</label>
          <select id="meeting-select" name="meeting">${options}</select>
        </div>
        ${status}
        ${errorHtml(view.error)}
        <div class="row">
          <button type="button" class="button small-button" data-action="check-all">전체 선택</button>
          <button type="button" class="button small-button" data-action="check-none">전체 해제</button>
        </div>
        <ul class="list check-list">${rows}</ul>
      </div>
      <div class="sticky-foot">
        <p class="count"><span class="num" id="present-count">${view.present.size}</span> <span class="muted">/ ${view.roster.length}명</span></p>
        <button class="button primary grow" type="submit">출석 저장</button>
      </div>
    </form>`
}

export interface AdminMeetingsView {
  today: string
  /** 최신이 위. */
  meetings: Meeting[]
  error: string | null
}

export function adminMeetingsHtml(view: AdminMeetingsView): string {
  const rows = view.meetings
    .map((m) => {
      const state = m.cancelled ? '취소됨' : m.checkedAt ? '집계됨' : m.date > view.today ? '예정' : '집계 전'
      const chip = m.cancelled ? 'cancelled' : m.checkedAt ? 'present' : m.date > view.today ? 'upcoming' : 'unchecked'
      const action = m.cancelled
        ? `<button type="button" class="button small-button" data-action="restore-meeting" data-id="${m.id}">되살리기</button>`
        : `<button type="button" class="button small-button" data-action="cancel-meeting" data-id="${m.id}">취소</button>`
      return `<li class="list-row">
        <span class="list-date">${shortDateLabel(m.date)}</span>
        <span class="list-note">${MEETING_KIND_LABEL[m.kind]}${m.place ? ` · ${esc(m.place)}` : ''}</span>
        <span class="chip chip-${chip}">${state}</span>
        ${action}
      </li>`
    })
    .join('')

  return `${adminHeadHtml('meetings', '정기모임')}
    <div class="page-body">
      <form id="meeting-form" class="card stack">
        <h2>모임 추가</h2>
        <div class="grid-2">
          <div class="field">
            <label for="meeting-date">날짜</label>
            <input id="meeting-date" name="date" type="date" required value="${view.today}" />
          </div>
          <div class="field">
            <label for="meeting-kind">종류</label>
            <select id="meeting-kind" name="kind">
              <option value="training">정기 훈련</option>
              <option value="record">기록회</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="meeting-place">장소 <span class="muted">(선택)</span></label>
          <input id="meeting-place" name="place" maxlength="40" />
        </div>
        ${errorHtml(view.error)}
        <button class="button primary" type="submit">추가</button>
      </form>
      <section class="card list-card">
        <ul class="list">${rows || '<li class="list-row muted">모임이 없습니다.</li>'}</ul>
      </section>
    </div>`
}

export interface AdminMembersView {
  today: string
  members: Member[]
  issued: { member: Member; code: string; expiresOn: string } | null
  /** 초대 문구에 넣을 앱 주소. */
  appUrl: string
  error: string | null
}

export function inviteMessage(name: string, code: string, expiresOn: string, appUrl: string): string {
  return `[나인틴] ${name} 님 초대코드: ${formatCode(code)}\n${shortDateLabel(expiresOn)}까지 쓸 수 있어요.\n${appUrl} 에서 '초대코드로 가입'을 누르세요.`
}

const MEMBER_STATUS_LABEL: Record<Member['status'], string> = {
  invited: '가입 전',
  active: '사용 중',
  inactive: '중지',
}

export function adminMembersHtml(view: AdminMembersView): string {
  const issued = view.issued
    ? `<section class="card issued" aria-live="polite">
        <p class="small">${esc(view.issued.member.displayName)} 님 초대코드 · ${shortDateLabel(view.issued.expiresOn)}까지</p>
        <p class="code">${formatCode(view.issued.code)}</p>
        <p class="small muted">이 코드는 다시 볼 수 없습니다. 지금 보내세요.</p>
        <textarea id="invite-message" readonly rows="3" aria-label="보낼 문구">${esc(inviteMessage(view.issued.member.displayName, view.issued.code, view.issued.expiresOn, view.appUrl))}</textarea>
        <button type="button" class="button primary" data-action="copy-invite">문구 복사</button>
      </section>`
    : ''

  const rows = view.members
    .map((m) => {
      const toggle =
        m.status === 'inactive'
          ? `<button type="button" class="button small-button" data-action="activate-member" data-id="${m.id}">다시 사용</button>`
          : `<button type="button" class="button small-button" data-action="deactivate-member" data-id="${m.id}">중지</button>`
      const invite =
        m.status === 'inactive'
          ? ''
          : `<button type="button" class="button small-button" data-action="issue-invite" data-id="${m.id}">${m.status === 'invited' ? '초대코드' : '비번 재설정'}</button>`
      return `<li class="member-row">
        <div class="member-name">
          <strong>${esc(m.displayName)}</strong>
          <span class="small muted">${m.role === 'admin' ? '운영자 · ' : ''}${MEMBER_STATUS_LABEL[m.status]}</span>
        </div>
        <div class="row">${invite}${toggle}</div>
      </li>`
    })
    .join('')

  return `${adminHeadHtml('members', '회원 명단')}
    <div class="page-body">
      ${issued}
      <form id="member-form" class="card stack">
        <h2>회원 추가</h2>
        <div class="field">
          <label for="member-name">이름 <span class="muted">(로그인 이름 · 동명이인은 김민수A 처럼)</span></label>
          <input id="member-name" name="name" required maxlength="30" />
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="member-joined">가입일</label>
            <input id="member-joined" name="joined" type="date" required value="${view.today}" />
          </div>
          <div class="field">
            <label for="member-role">역할</label>
            <select id="member-role" name="role">
              <option value="member">회원</option>
              <option value="admin">운영자</option>
            </select>
          </div>
        </div>
        ${errorHtml(view.error)}
        <button class="button primary" type="submit">추가하고 초대코드 받기</button>
      </form>
      <section class="card list-card">
        <ul class="list">${rows}</ul>
      </section>
    </div>`
}
