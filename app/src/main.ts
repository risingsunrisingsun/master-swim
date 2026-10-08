/**
 * 화면 배선과 해시 라우팅.
 *
 * 계산은 `core/`, HTML 은 `ui/views.ts`, 저장은 `data/` 에 있다. 여기서는 경로를 읽고
 * 데이터를 모아 그리고, 입력을 받아 저장소로 보낸다.
 */
import { monthHistory, monthSummary, nextMeeting } from './core/attendance'
import { addMonths, isValidIso, monthOf, todayIso } from './core/dates'
import { isCodeShape, normalizeCode, PASSWORD_MIN, passwordProblem } from './core/invite'
import {
  eventsByRecency,
  isPeriod,
  latestGoalGap,
  latestPb,
  nationalStanding,
  pbIds,
  periodStart,
  personalBest,
  recordsOf,
} from './core/records'
import { BIRTH_YEAR_MAX, BIRTH_YEAR_MIN, parseRoster, readBirthYear, readSex, ROSTER_MAX, type RosterEntry } from './core/roster'
import { type Bracket, BRACKETS, formulaPlanAt, planProblem, prescribe } from './core/sets'
import {
  eventKey,
  formatTime,
  hasMinuteField,
  parseEventKey,
  readTime,
  refoldTime,
  SET_EVENTS,
  sameEvent,
  timeFields,
  timeProblem,
} from './core/time'
import { type MeetingKind, type Member, SEX_LABEL, type SwimEvent } from './core/types'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'
import { type Backend, type MeetingEntry, UserFacingError } from './data/backend'
import { DEMO_ADMIN, DEMO_INVITE, DEMO_MEMBER, LocalBackend } from './data/local'
import { SupabaseBackend } from './data/supabase'
import { adminRecordsHtml, recordFormHtml, recordsHtml } from './ui/records'
import { adminSetsHtml, readPlanForm, setsHtml } from './ui/sets'
import {
  accountHtml,
  adminAttendanceHtml,
  adminMemberHtml,
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

const FREE_50: SwimEvent = { stroke: 'free', distance: 50 }
const isSetEvent = (event: SwimEvent | null): event is SwimEvent =>
  event !== null && SET_EVENTS.some((e) => sameEvent(e, event))

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
    case '/records': {
      const flash = takeFlash()
      const [records, goals, meetings] = await Promise.all([backend.myRecords(), backend.myGoals(), backend.meetings()])
      const events = eventsByRecency(records)
      const event = parseEventKey(route.query.get('e')) ?? events[0] ?? null
      const requestedPeriod = route.query.get('p')
      const period = isPeriod(requestedPeriod) ? requestedPeriod : 'all'
      const start = periodStart(period, today)
      const counts = new Map<string, number>()
      for (const r of records) counts.set(eventKey(r), (counts.get(eventKey(r)) ?? 0) + 1)
      return [
        recordsHtml({
          event,
          events,
          counts,
          period,
          records: event ? recordsOf(records, event).filter((r) => start === null || r.date >= start) : [],
          best: event ? personalBest(records, event) : null,
          standing: (() => {
            const best = event ? personalBest(records, event) : null
            return best ? nationalStanding(best.timeCs, best, member.sex, member.birthYear, today) : null
          })(),
          pbIds: pbIds(records),
          goalCs: (event && goals.find((g) => sameEvent(g, event))?.targetCs) ?? null,
          meetings: new Map(meetings.map((m) => [m.id, m])),
          saved: flash.saved,
          error: flash.error,
        }),
        'records',
      ]
    }
    case '/records/new':
    case '/records/edit': {
      const flash = takeFlash()
      const records = await backend.myRecords()
      if (route.path === '/records/edit') {
        const editing = records.find((r) => r.id === route.query.get('id') && r.source === 'self')
        if (!editing) {
          flashError = '고칠 수 있는 기록이 아닙니다. 모임 기록은 운영자가 고칩니다.'
          location.replace('#/records')
          return ['', 'records']
        }
        return [
          recordFormHtml({ editing, event: editing, date: editing.date, timeCs: editing.timeCs, note: editing.note, today, error: flash.error }),
          'records',
        ]
      }
      const event = parseEventKey(route.query.get('e')) ?? eventsByRecency(records)[0] ?? FREE_50
      return [recordFormHtml({ editing: null, event, date: today, timeCs: null, note: '', today, error: flash.error }), 'records']
    }
    case '/sets': {
      const flash = takeFlash()
      const [records, goals, overrides] = await Promise.all([backend.myRecords(), backend.myGoals(), backend.setOverrides()])
      const requested = parseEventKey(route.query.get('e'))
      const recentGoal = [...goals].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
      const event: SwimEvent = isSetEvent(requested)
        ? requested
        : isSetEvent(recentGoal)
          ? { stroke: recentGoal.stroke, distance: recentGoal.distance }
          : (eventsByRecency(records).find(isSetEvent) ?? FREE_50)
      const best = personalBest(records, event)
      const goalCs = goals.find((g) => sameEvent(g, event))?.targetCs ?? null
      return [
        setsHtml({
          event,
          best,
          goalCs,
          prescription: best ? prescribe(event, best.timeCs, goalCs ?? best.timeCs - 100, overrides, member.sex) : null,
          error: flash.error,
        }),
        'sets',
      ]
    }
    case '/account': {
      const flash = takeFlash()
      return [accountHtml({ member, saved: flash.saved, error: flash.error }), 'home']
    }
    default: {
      const [meetings, present, records, goals, tempPassword] = await Promise.all([
        backend.meetings(),
        backend.myPresentMeetingIds(),
        backend.myRecords(),
        backend.myGoals(),
        backend.passwordIsTemporary(),
      ])
      return [
        homeHtml({
          member,
          today,
          month: monthSummary(monthOf(today), meetings, present, member.joinedOn, today),
          next: nextMeeting(meetings, today),
          pb: latestPb(records),
          goal: latestGoalGap(goals, records),
          tempPassword,
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

  if (route.path === '/admin/records') {
    const meetings = (await backend.meetings())
      .filter((m) => !m.cancelled && m.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date))
    const selected =
      meetings.find((m) => m.id === route.query.get('id')) ??
      meetings.find((m) => m.kind === 'record') ??
      meetings[0] ??
      null
    const event = parseEventKey(route.query.get('e')) ?? FREE_50
    const [members, present, saved] = await Promise.all([
      backend.members(),
      selected ? backend.presentMemberIds(selected.id) : Promise.resolve(new Set<string>()),
      selected ? backend.meetingRecords(selected.id) : Promise.resolve([]),
    ])
    const values = new Map<string, { minutes: string; seconds: string }>()
    for (const r of saved) if (sameEvent(r, event)) values.set(r.memberId, timeFields(r.timeCs, event.distance))
    // 출석한 회원이 위로 — 기록회 당일 위에서부터 차례로 넣는다.
    const roster = members
      .filter((m) => m.status !== 'inactive')
      .sort((a, b) => Number(present.has(b.id)) - Number(present.has(a.id)) || byName(a, b))
    return adminRecordsHtml({ meetings, selected, event, roster, present, values, saved: flash.saved, error: flash.error })
  }

  if (route.path === '/admin/sets') {
    const requested = parseEventKey(route.query.get('e'))
    const event = isSetEvent(requested) ? requested : FREE_50
    const b = Number(route.query.get('b'))
    const bracket: Bracket = b === 2 || b === 3 ? b : 1
    const mine = (await backend.setOverrides()).filter((o) => sameEvent(o, event))
    const current = mine.find((o) => o.bracket === bracket)
    return adminSetsHtml({
      event,
      bracket,
      plan: current?.plan ?? formulaPlanAt(event, bracket, 'intermediate'),
      overriddenAt: current?.updatedAt ?? null,
      overridden: new Set(mine.map((o) => o.bracket)),
      saved: flash.saved,
      error: flash.error,
    })
  }

  if (route.path === '/admin/member') {
    const member = (await backend.members()).find((m) => m.id === route.query.get('id'))
    if (!member) {
      flashError = '회원을 찾을 수 없습니다.'
      location.replace('#/admin/members')
      return ''
    }
    const view = adminMemberHtml({
      member,
      issued: issued[0] ?? null,
      appUrl: location.origin + location.pathname,
      saved: flash.saved,
      error: flash.error,
    })
    issued = []
    return view
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

/**
 * 화면을 다시 그리지 않고 폼 안에 오류를 띄운다 — 넣던 값이 그대로 남는다.
 * 운영자가 30명 기록을 넣다가 한 칸이 틀렸다고 나머지를 다시 치게 하면 안 된다.
 */
function showFormError(form: HTMLFormElement, text: string): void {
  let box = form.querySelector<HTMLElement>('[data-error]') ?? form.querySelector<HTMLElement>('.form-error')
  if (!box) {
    box = document.createElement('p')
    box.className = 'form-error'
    box.setAttribute('role', 'alert')
    const submit = form.querySelector('button[type="submit"]')
    if (submit) submit.before(box)
    else form.append(box)
  }
  box.hidden = false
  box.textContent = text
  box.scrollIntoView({ block: 'center', behavior: 'smooth' })
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

  'password-form': async (form) => {
    const current = field(form, 'current')
    const next = field(form, 'password')
    const problem = current === '' ? '지금 비밀번호를 넣어 주세요.' : passwordProblem(next, field(form, 'confirm'))
    if (problem) return showFormError(form, problem)
    try {
      await backend.changePassword(current, next)
      flashSaved = true
      void render()
    } catch (error) {
      showFormError(form, message(error))
    }
  },

  'record-form': async (form) => {
    const event = parseEventKey(field(form, 'event'))
    const date = field(form, 'date')
    const timeCs = readTime(field(form, 'time-min'), field(form, 'time-sec'))
    const problem = !event
      ? '종목을 골라 주세요.'
      : !isValidIso(date) || date > todayIso()
        ? '날짜를 확인해 주세요. 오늘 뒤의 날짜는 넣을 수 없습니다.'
        : timeProblem(timeCs, event.distance)
    if (problem || !event || timeCs === null) return showFormError(form, problem ?? '기록을 확인해 주세요.')
    const input = { stroke: event.stroke, distance: event.distance, timeCs, date, note: field(form, 'note') }
    try {
      const id = field(form, 'id')
      if (id) await backend.updateRecord(id, input)
      else await backend.addRecord(input)
      flashSaved = true
      go(`#/records?e=${eventKey(event)}`)
    } catch (error) {
      showFormError(form, message(error))
    }
  },

  'goal-form': async (form) => {
    const event = parseEventKey(field(form, 'event'))
    if (!isSetEvent(event)) return showFormError(form, '종목을 골라 주세요.')
    const timeCs = readTime(field(form, 'goal-min'), field(form, 'goal-sec'))
    const problem = timeProblem(timeCs, event.distance)
    if (problem || timeCs === null) return showFormError(form, problem ?? '목표기록을 확인해 주세요.')
    try {
      const best = personalBest(await backend.myRecords(), event)
      if (best && timeCs >= best.timeCs) {
        return showFormError(form, `목표는 지금 최고기록 ${formatTime(best.timeCs)} 보다 빨라야 합니다.`)
      }
      await backend.saveGoal(event, timeCs)
      go(`#/sets?e=${eventKey(event)}`)
    } catch (error) {
      showFormError(form, message(error))
    }
  },

  'meeting-records-form': async (form) => {
    const meetingId = field(form, 'meeting')
    const event = parseEventKey(field(form, 'event'))
    if (!event) return showFormError(form, '종목을 골라 주세요.')
    const entries: MeetingEntry[] = []
    const wrong: string[] = []
    for (const input of form.querySelectorAll<HTMLInputElement>('input.sec-input')) {
      const memberId = input.name.slice(2)
      const minutes = form.querySelector<HTMLInputElement>(`input[name="m-${memberId}"]`)?.value ?? ''
      input.removeAttribute('aria-invalid')
      if (input.value.trim() === '' && minutes.trim() === '') continue
      const timeCs = readTime(minutes, input.value)
      if (timeProblem(timeCs, event.distance) || timeCs === null) {
        input.setAttribute('aria-invalid', 'true')
        wrong.push(input.closest('.entry-row')?.querySelector('.entry-name')?.firstChild?.textContent?.trim() ?? '')
        continue
      }
      entries.push({ memberId, timeCs })
    }
    if (wrong.length > 0) {
      return showFormError(form, `${wrong.join(', ')} — 기록을 확인해 주세요. 초 칸은 32.40 처럼 씁니다. 아직 저장하지 않았습니다.`)
    }
    try {
      await backend.saveMeetingRecords(meetingId, event, entries)
      flashSaved = true
      go(`#/admin/records?id=${meetingId}&e=${eventKey(event)}`)
    } catch (error) {
      showFormError(form, message(error))
    }
  },

  'override-form': async (form) => {
    const event = parseEventKey(field(form, 'event'))
    const bracket = Number(field(form, 'bracket')) as Bracket
    if (!isSetEvent(event) || !BRACKETS.includes(bracket)) return showFormError(form, '종목과 구간을 골라 주세요.')
    const plan = readPlanForm((name) => field(form, name))
    const problem = planProblem(plan)
    if (problem) return showFormError(form, problem)
    try {
      await backend.saveSetOverride(event, bracket, plan)
      flashSaved = true
      void render()
    } catch (error) {
      showFormError(form, message(error))
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
    const name = field(form, 'name').trim()
    const joinedOn = field(form, 'joined')
    const role = field(form, 'role') === 'admin' ? 'admin' : 'member'
    const sex = readSex(field(form, 'sex'))
    const birthYear = readBirthYear(field(form, 'birthYear'))
    const password = field(form, 'password').trim()
    const problem = !name
      ? '이름을 넣어 주세요.'
      : !isValidIso(joinedOn)
        ? '가입일을 확인해 주세요.'
        : Number.isNaN(birthYear)
          ? BIRTH_YEAR_PROBLEM
          : password && password.length < PASSWORD_MIN
            ? `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`
            : null
    if (problem) return showFormError(form, problem)

    let member: Member
    try {
      member = await backend.createMember({ displayName: name, role, joinedOn, sex, birthYear })
    } catch (error) {
      return showFormError(form, message(error))
    }
    try {
      if (password) {
        const [result] = await backend.setPasswords([{ memberId: member.id, password }])
        if (result?.error !== null) throw new UserFacingError(result?.error ?? '비밀번호를 정하지 못했습니다.')
        issued = [{ kind: 'password', member, password }]
      } else {
        issued = [{ kind: 'invite', member, ...(await backend.issueInvite(member.id)) }]
      }
    } catch (error) {
      flashError = `${name} 님은 추가됐지만 ${password ? '비밀번호를 정하지' : '초대코드를 만들지'} 못했습니다 — ${message(error)} 명단의 '정보 · 비번'에서 다시 하세요.`
    }
    void render()
  },

  'bulk-member-form': async (form) => {
    const text = field(form, 'names')
    const joinedOn = field(form, 'joined')
    const common = field(form, 'password').trim()
    bulkDraft = { text, joinedOn, problems: [] }
    try {
      if (!isValidIso(joinedOn)) throw new UserFacingError('가입일을 확인해 주세요.')
      if (common && common.length < PASSWORD_MIN) {
        throw new UserFacingError(`공통 비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`)
      }
      const existing = (await backend.members()).map((m) => m.displayName)
      const { entries, problems } = parseRoster(text, existing)
      if (problems.length > 0) {
        bulkDraft.problems = problems
        return
      }
      if (entries.length === 0) throw new UserFacingError('이름을 한 줄에 한 명씩 넣어 주세요.')
      if (entries.length > ROSTER_MAX) throw new UserFacingError(`한 번에 ${ROSTER_MAX}명까지 넣을 수 있습니다.`)

      // 한 명씩 차례로 만든다. 중간에 끊기면 거기서 멈추고, 남은 줄을 칸에 되돌려 다시 누르게 한다.
      // 비밀번호는 만든 사람을 모아 한 번에 정한다 — Edge Function 을 30번 부르지 않게.
      const withPassword: { member: Member; password: string }[] = []
      let stopped = false
      for (const [index, entry] of entries.entries()) {
        let member: Member | null = null
        try {
          member = await backend.createMember({
            displayName: entry.name,
            role: 'member',
            joinedOn,
            sex: entry.sex,
            birthYear: entry.birthYear,
          })
          const password = entry.password ?? (common || null)
          if (password) withPassword.push({ member, password })
          else issued.push({ kind: 'invite', member, ...(await backend.issueInvite(member.id)) })
        } catch (error) {
          const rest = entries.slice(member ? index + 1 : index)
          bulkDraft = rest.length > 0 ? { text: rest.map(rosterLine).join('\n'), joinedOn, problems: [] } : null
          flashError =
            `${entry.name} 에서 멈췄습니다 — ${message(error)}` +
            (index > 0 ? ` 앞의 ${index}명은 추가됐습니다.` : '') +
            (member ? ` ${entry.name} 님은 추가됐지만 초대코드가 없습니다. 명단의 '정보 · 비번'에서 이어서 하세요.` : '')
          stopped = true
          break
        }
      }

      if (withPassword.length > 0) {
        let failed: string[]
        try {
          const results = await backend.setPasswords(
            withPassword.map(({ member, password }) => ({ memberId: member.id, password })),
          )
          failed = []
          for (const { member, password } of withPassword) {
            const result = results.find((r) => r.memberId === member.id)
            if (result && result.error === null) issued.push({ kind: 'password', member, password })
            else failed.push(member.displayName)
          }
        } catch (error) {
          failed = withPassword.map(({ member }) => member.displayName)
          console.error(error)
        }
        if (failed.length > 0) {
          flashError =
            (flashError ? `${flashError} ` : '') +
            `${failed.join(', ')} 님은 추가됐지만 비밀번호를 정하지 못했습니다. 명단의 '정보 · 비번'에서 다시 정하세요.`
        }
      }
      if (!stopped) bulkDraft = null
    } catch (error) {
      flashError = message(error)
    } finally {
      void render()
    }
  },

  'profile-form': async (form) => {
    const id = field(form, 'id')
    const sex = readSex(field(form, 'sex'))
    const birthYear = readBirthYear(field(form, 'birthYear'))
    if (Number.isNaN(birthYear)) return showFormError(form, BIRTH_YEAR_PROBLEM)
    try {
      await backend.updateMemberProfile(id, { sex, birthYear })
      // 자기 정보를 고쳤으면 세트 · 기록 화면이 바로 쓰도록 들고 있는 값도 바꾼다.
      if (me && me.id === id) me = { ...me, sex, birthYear }
      flashSaved = true
      void render()
    } catch (error) {
      showFormError(form, message(error))
    }
  },

  'member-password-form': async (form) => {
    const id = field(form, 'id')
    const password = field(form, 'password').trim()
    if (password.length < PASSWORD_MIN) return showFormError(form, `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`)
    try {
      const member = (await backend.members()).find((m) => m.id === id)
      if (!member) throw new UserFacingError('회원을 찾을 수 없습니다.')
      const [result] = await backend.setPasswords([{ memberId: id, password }])
      if (result?.error !== null) throw new UserFacingError(result?.error ?? '비밀번호를 정하지 못했습니다.')
      issued = [{ kind: 'password', member, password }]
      void render()
    } catch (error) {
      showFormError(form, message(error))
    }
  },
}

const BIRTH_YEAR_PROBLEM = `출생연도는 1985 처럼 네 자리로 넣어 주세요 (${BIRTH_YEAR_MIN}~${BIRTH_YEAR_MAX}).`

/** 막힌 일괄 추가의 남은 사람을 다시 한 줄씩 적는다. */
function rosterLine(entry: RosterEntry): string {
  return [entry.name, entry.sex ? SEX_LABEL[entry.sex] : '', entry.birthYear ?? '', entry.password ?? '']
    .filter((part) => part !== '')
    .join(', ')
}

app.addEventListener('submit', (event) => {
  const form = event.target as HTMLFormElement
  // form.id 가 아니라 속성으로 읽는다 — 폼 안에 name="id" 칸이 있으면 form.id 는 그 칸을 돌려준다.
  const handler = submitHandlers[form.getAttribute('id') ?? '']
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
      issued = [{ kind: 'invite', member, ...(await backend.issueInvite(id)) }]
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

  'delete-record': async (button) => {
    // 확인 창 대신 두 번 누르기. 폰에서 confirm() 은 화면을 통째로 막는다.
    if (button.dataset.armed !== 'yes') {
      button.dataset.armed = 'yes'
      button.textContent = '한 번 더 누르면 지웁니다'
      return
    }
    const id = button.dataset.id
    if (!id) return
    try {
      await backend.deleteRecord(id)
      go('#/records')
    } catch (error) {
      const form = button.closest('form')
      if (form) showFormError(form, message(error))
    }
  },

  'goal-shortcut': (button) => {
    const form = button.closest('form')
    const cs = Number(button.dataset.cs)
    const distance = Number(button.dataset.distance) as SwimEvent['distance']
    if (!form || !Number.isFinite(cs)) return
    const fields = timeFields(cs, distance)
    const minutes = form.querySelector<HTMLInputElement>('input[name="goal-min"]')
    const seconds = form.querySelector<HTMLInputElement>('input[name="goal-sec"]')
    if (minutes) minutes.value = fields.minutes
    if (seconds) seconds.value = fields.seconds
    updateReadout(form.querySelector<HTMLElement>('.time-inputs'))
  },

  'reset-override': async (button) => {
    const event = parseEventKey(button.dataset.event)
    const bracket = Number(button.dataset.bracket) as Bracket
    if (!event || !BRACKETS.includes(bracket)) return
    try {
      await backend.deleteSetOverride(event, bracket)
    } catch (error) {
      flashError = message(error)
    }
    void render()
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
  if (target instanceof HTMLSelectElement && target.dataset.nav) {
    navigateFrom(target)
    return
  }
  if (target instanceof HTMLSelectElement && target.id === 'record-event') {
    refoldRecordTime(target)
    return
  }
  if (target instanceof HTMLInputElement && target.name === 'present') updatePresentCount()
})

app.addEventListener('input', (event) => {
  const target = event.target as HTMLElement
  updateReadout(target.closest<HTMLElement>('.time-inputs'))
  if (target.classList.contains('sec-input') || target.classList.contains('min-input')) updateFilledCount()
})

/** 종목 · 모임을 고르는 select 는 주소를 바꾼다 — 뒤로 가기가 그대로 먹는다. */
function navigateFrom(select: HTMLSelectElement): void {
  const value = encodeURIComponent(select.value)
  const data = select.dataset
  const routes: Record<string, string> = {
    records: `#/records?e=${value}&p=${data.period ?? 'all'}`,
    sets: `#/sets?e=${value}`,
    'admin-records': `#/admin/records?id=${value}&e=${data.event ?? ''}`,
    'admin-records-event': `#/admin/records?id=${data.meeting ?? ''}&e=${value}`,
    'admin-sets': `#/admin/sets?e=${value}&b=1`,
  }
  const hash = routes[data.nav ?? '']
  if (hash) go(hash)
}

/** 기록 넣기에서 종목을 바꾸면 분 칸을 숨기거나 보이고, 같은 기록을 가리키게 다시 접는다. */
function refoldRecordTime(select: HTMLSelectElement): void {
  const event = parseEventKey(select.value)
  const box = select.form?.querySelector<HTMLElement>('.time-inputs')
  if (!event || !box) return
  const minutes = box.querySelector<HTMLInputElement>('input[name$="-min"]')
  const seconds = box.querySelector<HTMLInputElement>('input[name$="-sec"]')
  const part = box.querySelector<HTMLElement>('.min-part')
  if (!minutes || !seconds || !part) return
  const withMinutes = hasMinuteField(event.distance)
  const folded = refoldTime(minutes.value, seconds.value, !withMinutes)
  minutes.value = folded.minutes
  seconds.value = folded.seconds
  part.hidden = !withMinutes
  updateReadout(box)
}

/** 두 칸 옆에 읽은 기록을 보여준다 — `32.4` 가 32.40 으로 읽혔는지 바로 확인한다. */
function updateReadout(box: HTMLElement | null): void {
  if (!box) return
  const minutes = box.querySelector<HTMLInputElement>('input[name$="-min"]')?.value ?? ''
  const seconds = box.querySelector<HTMLInputElement>('input[name$="-sec"]')?.value ?? ''
  const output = box.querySelector('output')
  if (!output) return
  const cs = readTime(minutes, seconds)
  output.textContent = seconds.trim() === '' ? '' : cs === null ? '읽을 수 없음' : `= ${formatTime(cs)}`
}

function updateFilledCount(): void {
  const label = app.querySelector('#filled-count')
  if (!label) return
  const filled = [...app.querySelectorAll<HTMLInputElement>('input.sec-input')].filter((i) => i.value.trim() !== '').length
  label.textContent = String(filled)
}

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
