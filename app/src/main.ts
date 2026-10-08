/**
 * 화면 배선과 해시 라우팅.
 *
 * 계산은 `core/`, HTML 은 `ui/views.ts`, 저장은 `data/` 에 있다. 여기서는 경로를 읽고
 * 데이터를 모아 그리고, 입력을 받아 저장소로 보낸다.
 */
import { monthHistory, monthSummary, nextMeeting } from './core/attendance'
import { addMonths, isValidIso, monthOf, todayIso } from './core/dates'
import { isCodeShape, normalizeCode, passwordProblem } from './core/invite'
import { parseRoster, ROSTER_MAX } from './core/roster'
import type { MeetingKind, Member } from './core/types'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'
import { type Backend, UserFacingError } from './data/backend'
import { DEMO_ADMIN, DEMO_INVITE, DEMO_MEMBER, LocalBackend } from './data/local'
import { SupabaseBackend } from './data/supabase'
import {
  adminAttendanceHtml,
  adminMeetingsHtml,
  adminMembersHtml,
  attendanceHtml,
  type BulkDraft,
  comingSoonHtml,
  demoBannerHtml,
  homeHtml,
  type IssuedCode,
  type LoginMode,
  loginHtml,
  type Tab,
  tabbarHtml,
} from './ui/views'

const backend: Backend =
  SUPABASE_URL && SUPABASE_ANON_KEY ? new SupabaseBackend(SUPABASE_URL, SUPABASE_ANON_KEY) : new LocalBackend(localStorage)

const root = document.getElementById('app')
if (!root) throw new Error('#app 이 없습니다.')
const app: HTMLElement = root

/** 막대그래프에 보여줄 달 수. */
const HISTORY_MONTHS = 6

// ── 화면 사이에 남는 상태 ─────────────────────────────────────
// 한 번 보여주고 지우는 것들이다(오류 문구 · 방금 발급한 코드 · "저장했습니다").

let me: Member | null | undefined
let loginError: string | null = null
let lastLoginName = ''
let flashError: string | null = null
let flashSaved = false
let issued: IssuedCode[] = []
let bulkDraft: BulkDraft | null = null

function takeFlash(): { error: string | null; saved: boolean } {
  const flash = { error: flashError, saved: flashSaved }
  flashError = null
  flashSaved = false
  return flash
}

// ── 라우팅 ───────────────────────────────────────────────────

interface Route {
  path: string
  query: URLSearchParams
}

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/home'
  const [path = '/home', search = ''] = raw.split('?')
  return { path, query: new URLSearchParams(search) }
}

function go(hash: string): void {
  if (location.hash === hash) void render()
  else location.hash = hash
}

let renderToken = 0

async function render(): Promise<void> {
  const token = ++renderToken
  const route = parseHash(location.hash)

  if (me === undefined) {
    app.innerHTML = `<p class="loading">불러오는 중…</p>`
    me = await backend.me().catch(() => null)
  }

  let html: string
  let tab: Tab | null = null
  try {
    if (!me) {
      const mode: LoginMode = route.path === '/join' ? 'join' : 'login'
      if (route.path !== '/login' && route.path !== '/join') {
        location.replace('#/login')
        return
      }
      html = loginHtml({
        mode,
        error: loginError,
        name: lastLoginName,
        demoAccounts: backend.demo
          ? { admin: DEMO_ADMIN.name, member: DEMO_MEMBER.name, password: DEMO_MEMBER.password, invite: DEMO_INVITE }
          : null,
      })
      loginError = null
    } else {
      ;[html, tab] = await screen(route, me)
    }
  } catch (error) {
    if (error instanceof UserFacingError && error.message.includes('로그인')) {
      me = null
      location.replace('#/login')
      return
    }
    html = `<div class="page-body"><section class="card soft"><p role="alert">${
      error instanceof UserFacingError ? error.message : '화면을 그리지 못했습니다. 새로고침해 주세요.'
    }</p></section></div>`
    tab = 'home'
    console.error(error)
  }

  // 느린 응답이 나중에 온 화면을 덮지 않게 한다.
  if (token !== renderToken) return

  const banner = backend.demo ? demoBannerHtml() : ''
  const nav = me && tab ? tabbarHtml(tab, me.role === 'admin') : ''
  app.innerHTML = `${banner}<main class="screen${nav ? ' has-tabbar' : ''}">${html}</main>${nav}`
  app.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
  window.scrollTo(0, 0)
}

async function screen(route: Route, member: Member): Promise<[string, Tab]> {
  const today = todayIso()

  if (route.path === '/login' || route.path === '/join') {
    location.replace('#/home')
    return ['', 'home']
  }

  if (route.path.startsWith('/admin')) {
    if (member.role !== 'admin') return [comingSoonHtml('운영', '운영자만 볼 수 있는 화면입니다.'), 'home']
    return [await adminScreen(route, today), 'admin']
  }

  switch (route.path) {
    case '/attendance': {
      const requested = route.query.get('m') ?? ''
      const current = monthOf(today)
      const month = /^\d{4}-\d{2}$/.test(requested) && requested <= current ? requested : current
      const [meetings, present] = await Promise.all([backend.meetings(), backend.myPresentMeetingIds()])
      return [
        attendanceHtml({
          today,
          summary: monthSummary(month, meetings, present, member.joinedOn, today),
          history: monthHistory(month, HISTORY_MONTHS, meetings, present, member.joinedOn, today),
          prevMonth: addMonths(month, -1),
          nextMonth: month < current ? addMonths(month, 1) : null,
        }),
        'attendance',
      ]
    }
    case '/records':
      return [comingSoonHtml('나의 기록', '기록 추이는 다음 업데이트에서 열립니다.'), 'records']
    case '/sets':
      return [comingSoonHtml('기록 단축 세트', '단축 세트는 다음 업데이트에서 열립니다.'), 'sets']
    default: {
      const [meetings, present] = await Promise.all([backend.meetings(), backend.myPresentMeetingIds()])
      return [
        homeHtml({
          member,
          today,
          month: monthSummary(monthOf(today), meetings, present, member.joinedOn, today),
          next: nextMeeting(meetings, today),
        }),
        'home',
      ]
    }
  }
}

async function adminScreen(route: Route, today: string): Promise<string> {
  const flash = takeFlash()

  if (route.path === '/admin/meetings') {
    const meetings = (await backend.meetings()).sort((a, b) => b.date.localeCompare(a.date))
    return adminMeetingsHtml({ today, meetings, error: flash.error })
  }

  if (route.path === '/admin/members') {
    const members = (await backend.members()).sort(byName)
    const view = adminMembersHtml({
      today,
      members,
      issued,
      bulk: bulkDraft,
      appUrl: location.origin + location.pathname,
      error: flash.error,
    })
    issued = []
    bulkDraft = null
    return view
  }

  // 기본: 출석 체크
  const meetings = (await backend.meetings())
    .filter((m) => !m.cancelled && m.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
  const selected = meetings.find((m) => m.id === route.query.get('id')) ?? meetings[0] ?? null
  const [members, present] = await Promise.all([
    backend.members(),
    selected ? backend.presentMemberIds(selected.id) : Promise.resolve(new Set<string>()),
  ])
  return adminAttendanceHtml({
    meetings,
    selected,
    roster: members.filter((m) => m.status !== 'inactive').sort(byName),
    present,
    saved: flash.saved,
    error: flash.error,
  })
}

const byName = (a: Member, b: Member) => a.displayName.localeCompare(b.displayName, 'ko')

// ── 입력 ─────────────────────────────────────────────────────

function field(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name)
  return typeof value === 'string' ? value : ''
}

function message(error: unknown): string {
  if (error instanceof UserFacingError) return error.message
  console.error(error)
  return '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

/** 제출 중에는 버튼을 잠근다. 느린 망에서 두 번 누르면 모임이 두 개 생긴다. */
async function busy(form: HTMLFormElement, work: () => Promise<void>): Promise<void> {
  const buttons = [...form.querySelectorAll<HTMLButtonElement>('button')]
  for (const button of buttons) button.disabled = true
  try {
    await work()
  } finally {
    for (const button of buttons) button.disabled = false
  }
}

const submitHandlers: Record<string, (form: HTMLFormElement) => Promise<void>> = {
  'login-form': async (form) => {
    lastLoginName = field(form, 'name').trim()
    try {
      me = await backend.signIn(lastLoginName, field(form, 'password'))
      go('#/home')
    } catch (error) {
      loginError = message(error)
      void render()
    }
  },

  'join-form': async (form) => {
    const code = normalizeCode(field(form, 'code'))
    const password = field(form, 'password')
    const problem = !isCodeShape(code)
      ? '초대코드는 8자입니다. 받은 코드를 다시 확인해 주세요.'
      : passwordProblem(password, field(form, 'confirm'))
    if (problem) {
      loginError = problem
      void render()
      return
    }
    try {
      me = await backend.redeemInvite(code, password)
      go('#/home')
    } catch (error) {
      loginError = message(error)
      void render()
    }
  },

  'attendance-form': async (form) => {
    const meetingId = field(form, 'meeting')
    const present = new FormData(form).getAll('present').filter((v): v is string => typeof v === 'string')
    try {
      await backend.saveAttendance(meetingId, present)
      flashSaved = true
    } catch (error) {
      flashError = message(error)
    }
    go(`#/admin/attendance?id=${meetingId}`)
  },

  'meeting-form': async (form) => {
    const date = field(form, 'date')
    const kind = field(form, 'kind') as MeetingKind
    if (!isValidIso(date) || (kind !== 'training' && kind !== 'record')) {
      flashError = '날짜를 확인해 주세요.'
    } else {
      try {
        await backend.createMeeting({ date, kind, place: field(form, 'place').trim() })
      } catch (error) {
        flashError = message(error)
      }
    }
    void render()
  },

  'member-form': async (form) => {
    const joinedOn = field(form, 'joined')
    const role = field(form, 'role') === 'admin' ? 'admin' : 'member'
    try {
      if (!isValidIso(joinedOn)) throw new UserFacingError('가입일을 확인해 주세요.')
      const member = await backend.createMember({ displayName: field(form, 'name'), role, joinedOn })
      const invite = await backend.issueInvite(member.id)
      issued = [{ member, ...invite }]
    } catch (error) {
      flashError = message(error)
    }
    void render()
  },

  'bulk-member-form': async (form) => {
    const text = field(form, 'names')
    const joinedOn = field(form, 'joined')
    bulkDraft = { text, joinedOn, problems: [] }
    try {
      if (!isValidIso(joinedOn)) throw new UserFacingError('가입일을 확인해 주세요.')
      const existing = (await backend.members()).map((m) => m.displayName)
      const { names, problems } = parseRoster(text, existing)
      if (problems.length > 0) {
        bulkDraft.problems = problems
        return
      }
      if (names.length === 0) throw new UserFacingError('이름을 한 줄에 한 명씩 넣어 주세요.')
      if (names.length > ROSTER_MAX) throw new UserFacingError(`한 번에 ${ROSTER_MAX}명까지 넣을 수 있습니다.`)

      // 한 명씩 차례로. 중간에 끊기면 거기서 멈추고, 남은 이름을 칸에 되돌려 다시 누르게 한다.
      for (const [index, name] of names.entries()) {
        let member: Member | null = null
        try {
          member = await backend.createMember({ displayName: name, role: 'member', joinedOn })
          issued.push({ member, ...(await backend.issueInvite(member.id)) })
        } catch (error) {
          const rest = names.slice(member ? index + 1 : index)
          bulkDraft = rest.length > 0 ? { text: rest.join('\n'), joinedOn, problems: [] } : null
          flashError =
            `${name} 에서 멈췄습니다 — ${message(error)}` +
            (index > 0 ? ` 앞의 ${index}명은 추가됐습니다.` : '') +
            (member ? ` ${name} 님은 추가됐지만 초대코드가 없습니다. 명단에서 초대코드를 눌러 주세요.` : '')
          return
        }
      }
      bulkDraft = null
    } catch (error) {
      flashError = message(error)
    } finally {
      void render()
    }
  },
}

app.addEventListener('submit', (event) => {
  const form = event.target as HTMLFormElement
  const handler = submitHandlers[form.id]
  if (!handler) return
  event.preventDefault()
  void busy(form, () => handler(form))
})

const clickHandlers: Record<string, (button: HTMLButtonElement) => Promise<void> | void> = {
  'check-all': () => setAllChecked(true),
  'check-none': () => setAllChecked(false),

  'cancel-meeting': (button) => meetingCancelled(button.dataset.id, true),
  'restore-meeting': (button) => meetingCancelled(button.dataset.id, false),

  'issue-invite': async (button) => {
    const id = button.dataset.id
    if (!id) return
    try {
      const member = (await backend.members()).find((m) => m.id === id)
      if (!member) return
      issued = [{ member, ...(await backend.issueInvite(id)) }]
    } catch (error) {
      flashError = message(error)
    }
    void render()
  },

  'activate-member': (button) => memberActive(button.dataset.id, true),
  'deactivate-member': (button) => memberActive(button.dataset.id, false),

  'copy-invite': async (button) => {
    const text = document.querySelector<HTMLTextAreaElement>('#invite-message')
    if (!text) return
    try {
      await navigator.clipboard.writeText(text.value)
      button.textContent = '복사했습니다'
    } catch {
      // 클립보드 권한이 없는 브라우저 — 골라 두기라도 해서 길게 눌러 복사하게 한다.
      text.select()
      button.textContent = '골라 두었습니다 · 길게 눌러 복사하세요'
    }
  },

  'copy-text': async (button) => {
    try {
      await navigator.clipboard.writeText(button.dataset.text ?? '')
      button.textContent = '복사함'
    } catch {
      button.textContent = '아래 전체 문구에서 복사하세요'
    }
  },

  'sign-out': async () => {
    await backend.signOut()
    me = null
    go('#/login')
  },
}

app.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
  const handler = button && clickHandlers[button.dataset.action ?? '']
  if (!button || !handler) return
  void handler(button)
})

app.addEventListener('change', (event) => {
  const target = event.target as HTMLElement
  if (target.id === 'meeting-select') {
    go(`#/admin/attendance?id=${(target as HTMLSelectElement).value}`)
    return
  }
  if (target instanceof HTMLInputElement && target.name === 'present') updatePresentCount()
})

function setAllChecked(checked: boolean): void {
  for (const box of app.querySelectorAll<HTMLInputElement>('input[name="present"]')) box.checked = checked
  updatePresentCount()
}

function updatePresentCount(): void {
  const count = app.querySelectorAll('input[name="present"]:checked').length
  const label = app.querySelector('#present-count')
  if (label) label.textContent = String(count)
}

async function meetingCancelled(id: string | undefined, cancelled: boolean): Promise<void> {
  if (!id) return
  try {
    await backend.setMeetingCancelled(id, cancelled)
  } catch (error) {
    flashError = message(error)
  }
  void render()
}

async function memberActive(id: string | undefined, active: boolean): Promise<void> {
  if (!id) return
  try {
    await backend.setMemberActive(id, active)
  } catch (error) {
    flashError = message(error)
  }
  void render()
}

window.addEventListener('hashchange', () => void render())
void render()
