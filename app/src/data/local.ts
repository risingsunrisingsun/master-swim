/**
 * 데모 모드 저장소. Supabase 설정이 비어 있을 때 뜬다(ADR-0010).
 *
 * 서버 없이 화면과 흐름을 검토하기 위한 것이다. **보안이 없다** — 비밀번호가 평문으로
 * 이 기기의 localStorage 에 있다. 실제 회원 데이터를 넣지 않는다.
 * 권한 규칙(운영자만 명단·출석을 다룬다)은 SupabaseBackend 의 RLS 와 같게 흉내 낸다.
 */
import { addMonths, isoOf, monthOf, todayIso } from '../core/dates'
import { generateCode, INVITE_DAYS, isCodeShape, normalizeCode } from '../core/invite'
import type { Meeting, MeetingInput, Member } from '../core/types'
import { type Backend, type IssuedInvite, type NewMemberInput, UserFacingError } from './backend'

/** localStorage 와 같은 모양. 테스트는 Map 으로 대신한다. */
export interface KeyValue {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const KEY = 'nineteen-demo-v1'
const SESSION_KEY = 'nineteen-demo-session'

interface StoredMember extends Member {
  password: string | null
}

interface Invite {
  code: string
  memberId: string
  expiresOn: string
  usedAt: string | null
}

interface State {
  members: StoredMember[]
  meetings: Meeting[]
  /** `${meetingId}|${memberId}` — 참석만 담는다. */
  present: string[]
  invites: Invite[]
}

export const DEMO_ADMIN = { name: '운영자', password: 'demo1234' }
export const DEMO_MEMBER = { name: '홍길동', password: 'demo1234' }
/** '회원 08' 의 초대코드. 헷갈리는 글자(O·I·1·0)가 없는 알파벳 안에서 골랐다. */
export const DEMO_INVITE = 'TEAM2345'

export class LocalBackend implements Backend {
  readonly demo = true

  constructor(
    private readonly store: KeyValue,
    private readonly today: () => string = () => todayIso(),
    private readonly random: () => number = Math.random,
  ) {}

  async me(): Promise<Member | null> {
    const id = this.store.getItem(SESSION_KEY)
    const member = this.load().members.find((m) => m.id === id)
    return member && member.status === 'active' ? strip(member) : null
  }

  async signIn(displayName: string, password: string): Promise<Member> {
    const member = this.load().members.find((m) => m.displayName === displayName.trim())
    if (!member || member.password === null || member.password !== password) {
      throw new UserFacingError('이름 또는 비밀번호가 맞지 않습니다.')
    }
    if (member.status !== 'active') throw new UserFacingError('사용이 중지된 계정입니다. 운영자에게 문의하세요.')
    this.store.setItem(SESSION_KEY, member.id)
    return strip(member)
  }

  async redeemInvite(code: string, password: string): Promise<Member> {
    const state = this.load()
    const normalized = normalizeCode(code)
    const invite = state.invites.find((i) => i.code === normalized)
    if (!isCodeShape(normalized) || !invite || invite.usedAt !== null || invite.expiresOn < this.today()) {
      throw new UserFacingError('초대코드가 맞지 않거나 기한이 지났습니다. 운영자에게 새 코드를 받으세요.')
    }
    const member = state.members.find((m) => m.id === invite.memberId)
    if (!member || member.status === 'inactive') throw new UserFacingError('사용이 중지된 계정입니다.')

    member.password = password
    member.status = 'active'
    invite.usedAt = this.today()
    this.save(state)
    this.store.setItem(SESSION_KEY, member.id)
    return strip(member)
  }

  async signOut(): Promise<void> {
    this.store.removeItem(SESSION_KEY)
  }

  async meetings(): Promise<Meeting[]> {
    await this.requireMember()
    return this.load().meetings.map((m) => ({ ...m }))
  }

  async myPresentMeetingIds(): Promise<Set<string>> {
    const me = await this.requireMember()
    const suffix = `|${me.id}`
    return new Set(
      this.load()
        .present.filter((key) => key.endsWith(suffix))
        .map((key) => key.slice(0, -suffix.length)),
    )
  }

  async members(): Promise<Member[]> {
    await this.requireAdmin()
    return this.load().members.map(strip)
  }

  async createMember(input: NewMemberInput): Promise<Member> {
    await this.requireAdmin()
    const state = this.load()
    const displayName = input.displayName.trim()
    if (!displayName) throw new UserFacingError('이름을 넣어주세요.')
    if (state.members.some((m) => m.displayName === displayName)) {
      throw new UserFacingError('같은 이름이 이미 있습니다. 김민수A 처럼 구분해 주세요.')
    }
    const member: StoredMember = {
      id: crypto.randomUUID(),
      displayName,
      role: input.role,
      status: 'invited',
      joinedOn: input.joinedOn,
      password: null,
    }
    state.members.push(member)
    this.save(state)
    return strip(member)
  }

  async setMemberActive(memberId: string, active: boolean): Promise<void> {
    const me = await this.requireAdmin()
    if (memberId === me.id && !active) throw new UserFacingError('자기 계정은 중지할 수 없습니다.')
    const state = this.load()
    const member = state.members.find((m) => m.id === memberId)
    if (!member) return
    member.status = active ? (member.password === null ? 'invited' : 'active') : 'inactive'
    this.save(state)
  }

  async issueInvite(memberId: string): Promise<IssuedInvite> {
    await this.requireAdmin()
    const state = this.load()
    // 새 코드를 내면 그 회원의 안 쓴 옛 코드는 무효다. 코드가 둘 돌아다니면 안 된다.
    for (const invite of state.invites) {
      if (invite.memberId === memberId && invite.usedAt === null) invite.usedAt = this.today()
    }
    const code = generateCode(this.random)
    const expiresOn = addDays(this.today(), INVITE_DAYS)
    state.invites.push({ code, memberId, expiresOn, usedAt: null })
    this.save(state)
    return { code, expiresOn }
  }

  async createMeeting(input: MeetingInput): Promise<Meeting> {
    await this.requireAdmin()
    const state = this.load()
    const meeting: Meeting = { id: crypto.randomUUID(), ...input, cancelled: false, checkedAt: null }
    state.meetings.push(meeting)
    this.save(state)
    return { ...meeting }
  }

  async setMeetingCancelled(meetingId: string, cancelled: boolean): Promise<void> {
    await this.requireAdmin()
    const state = this.load()
    const meeting = state.meetings.find((m) => m.id === meetingId)
    if (meeting) meeting.cancelled = cancelled
    this.save(state)
  }

  async presentMemberIds(meetingId: string): Promise<Set<string>> {
    await this.requireAdmin()
    const prefix = `${meetingId}|`
    return new Set(
      this.load()
        .present.filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length)),
    )
  }

  async saveAttendance(meetingId: string, presentMemberIds: readonly string[]): Promise<void> {
    await this.requireAdmin()
    const state = this.load()
    const meeting = state.meetings.find((m) => m.id === meetingId)
    if (!meeting) throw new UserFacingError('모임을 찾을 수 없습니다.')
    const prefix = `${meetingId}|`
    state.present = state.present
      .filter((key) => !key.startsWith(prefix))
      .concat(presentMemberIds.map((id) => prefix + id))
    meeting.checkedAt = new Date().toISOString()
    this.save(state)
  }

  // ── 내부 ───────────────────────────────────────────────

  private async requireMember(): Promise<Member> {
    const me = await this.me()
    if (!me) throw new UserFacingError('다시 로그인해 주세요.')
    return me
  }

  private async requireAdmin(): Promise<Member> {
    const me = await this.requireMember()
    if (me.role !== 'admin') throw new UserFacingError('운영자만 할 수 있습니다.')
    return me
  }

  private load(): State {
    const raw = this.store.getItem(KEY)
    if (raw) {
      try {
        return JSON.parse(raw) as State
      } catch {
        // 깨진 데모 데이터는 버리고 새로 심는다. 데모라서 할 수 있는 일이다.
      }
    }
    const seeded = seed(this.today(), this.random)
    this.save(seeded)
    return seeded
  }

  private save(state: State): void {
    this.store.setItem(KEY, JSON.stringify(state))
  }
}

function strip({ password: _password, ...member }: StoredMember): Member {
  return member
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return isoOf(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
}

/**
 * 데모 데이터. 지난 6개월 + 다음 달까지 화·목 훈련, 매달 마지막 토요일 기록회.
 * 지난 모임은 출석이 집계돼 있고, 가장 최근 모임 하나는 **집계 전**으로 남겨
 * 운영자 화면에서 바로 체크해 볼 수 있게 한다.
 */
function seed(today: string, random: () => number): State {
  const startMonth = addMonths(monthOf(today), -5)
  const joinedOn = `${startMonth}-01`
  const names = ['홍길동', '회원 02', '회원 03', '회원 04', '회원 05', '회원 06', '회원 07', '회원 08']

  const members: StoredMember[] = [
    { id: 'demo-admin', displayName: DEMO_ADMIN.name, role: 'admin', status: 'active', joinedOn, password: DEMO_ADMIN.password },
    ...names.map((displayName, i): StoredMember => ({
      id: `demo-${i + 1}`,
      displayName,
      role: 'member',
      // 회원 08 은 초대만 받은 상태 — 가입 흐름을 시험해 볼 수 있다.
      status: i === names.length - 1 ? 'invited' : 'active',
      joinedOn,
      password: i === 0 ? DEMO_MEMBER.password : i === names.length - 1 ? null : DEMO_MEMBER.password,
    })),
  ]

  const meetings: Meeting[] = []
  for (let offset = 0; offset < 7; offset++) {
    const month = addMonths(startMonth, offset)
    const [y, m] = month.split('-').map(Number) as [number, number]
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    let lastSaturday = ''
    for (let d = 1; d <= last; d++) {
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
      const date = isoOf(y, m, d)
      if (weekday === 2 || weekday === 4) {
        meetings.push({ id: `mt-${date}`, date, kind: 'training', place: '[수영장 이름]', cancelled: false, checkedAt: null })
      }
      if (weekday === 6) lastSaturday = date
    }
    meetings.push({ id: `mt-${lastSaturday}`, date: lastSaturday, kind: 'record', place: '[수영장 이름]', cancelled: false, checkedAt: null })
  }
  meetings.sort((a, b) => a.date.localeCompare(b.date))

  const past = meetings.filter((m) => m.date <= today)
  const present: string[] = []
  past.forEach((meeting, index) => {
    if (index === past.length - 1) return // 가장 최근 모임은 집계 전
    if (index % 11 === 5) {
      meeting.cancelled = true
      return
    }
    meeting.checkedAt = `${meeting.date}T22:00:00.000Z`
    for (const member of members) {
      if (member.status !== 'active' || member.role === 'admin') continue
      if (random() < 0.72) present.push(`${meeting.id}|${member.id}`)
    }
  })

  const invites: Invite[] = [
    { code: DEMO_INVITE, memberId: `demo-${names.length}`, expiresOn: addDays(today, INVITE_DAYS), usedAt: null },
  ]

  return { members, meetings, present, invites }
}
