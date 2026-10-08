/**
 * 운영 저장소(ADR-0010). 권한은 DB 의 RLS 가 판정하고, 여기서는 모양만 옮긴다.
 * 스키마는 `app/supabase/migrations/` 에 있다.
 */
import { createClient, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import { type Bracket, parsePlan, type SetOverride, type SetPlan } from '../core/sets'
import type { Goal, Meeting, MeetingInput, Member, RecordInput, SwimEvent, SwimRecord } from '../core/types'
import {
  type Backend,
  type IssuedInvite,
  type MeetingEntry,
  type MemberProfile,
  type NewMemberInput,
  type PasswordEntry,
  type PasswordResult,
  UserFacingError,
} from './backend'

const MEMBER_COLUMNS = 'id, display_name, role, status, joined_on, sex, birth_year'
const MEETING_COLUMNS = 'id, date, kind, place, cancelled, checked_at'
const RECORD_COLUMNS = 'id, member_id, stroke, distance, time_cs, date, source, meeting_id, note'

interface MemberRow {
  id: string
  display_name: string
  role: Member['role']
  status: Member['status']
  joined_on: string
  sex: Member['sex']
  birth_year: number | null
}

interface MeetingRow {
  id: string
  date: string
  kind: Meeting['kind']
  place: string
  cancelled: boolean
  checked_at: string | null
}

interface RecordRow {
  id: string
  member_id: string
  stroke: SwimRecord['stroke']
  distance: SwimRecord['distance']
  time_cs: number
  date: string
  source: SwimRecord['source']
  meeting_id: string | null
  note: string
}

const toRecord = (row: RecordRow): SwimRecord => ({
  id: row.id,
  memberId: row.member_id,
  stroke: row.stroke,
  distance: row.distance,
  timeCs: row.time_cs,
  date: row.date,
  source: row.source,
  meetingId: row.meeting_id,
  note: row.note,
})

const toMember = (row: MemberRow): Member => ({
  id: row.id,
  displayName: row.display_name,
  role: row.role,
  status: row.status,
  joinedOn: row.joined_on,
  sex: row.sex,
  birthYear: row.birth_year,
})

const toMeeting = (row: MeetingRow): Meeting => ({
  id: row.id,
  date: row.date,
  kind: row.kind,
  place: row.place,
  cancelled: row.cancelled,
  checkedAt: row.checked_at,
})

const BAD_LOGIN = '이름 또는 비밀번호가 맞지 않습니다.'

export class SupabaseBackend implements Backend {
  readonly demo = false
  private readonly client: SupabaseClient

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nineteen-auth' },
    })
  }

  async me(): Promise<Member | null> {
    const { data: auth } = await this.client.auth.getSession()
    const userId = auth.session?.user.id
    if (!userId) return null
    const { data } = await this.client
      .from('members')
      .select(MEMBER_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle<MemberRow>()
    return data && data.status === 'active' ? toMember(data) : null
  }

  async signIn(displayName: string, password: string): Promise<Member> {
    const { data: email, error } = await this.client.rpc('login_email', { p_name: displayName.trim() })
    if (error) throw new UserFacingError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    if (typeof email !== 'string') throw new UserFacingError(BAD_LOGIN)

    const { error: authError } = await this.client.auth.signInWithPassword({ email, password })
    if (authError) {
      throw new UserFacingError(
        authError.status === 429 ? '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' : BAD_LOGIN,
      )
    }

    const member = await this.me()
    if (!member) {
      await this.client.auth.signOut()
      throw new UserFacingError('사용이 중지된 계정입니다. 운영자에게 문의하세요.')
    }
    return member
  }

  async redeemInvite(code: string, password: string): Promise<Member> {
    const { data, error } = await this.client.functions.invoke<{ displayName: string }>('redeem-invite', {
      body: { code, password },
    })
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null)
        if (body && typeof body.error === 'string') throw new UserFacingError(body.error)
      }
      throw new UserFacingError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
    if (!data) throw new UserFacingError('가입하지 못했습니다.')
    return this.signIn(data.displayName, password)
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut()
  }

  async changePassword(current: string, next: string): Promise<void> {
    const { data } = await this.client.auth.getSession()
    const email = data.session?.user.email
    if (!email) throw new UserFacingError('다시 로그인해 주세요.')

    // 폰을 잠깐 빌린 사람이 비밀번호를 바꾸지 못하게, 지금 비밀번호로 한 번 더 들어와 본다.
    // 방금 들어온 세션이라 Supabase 의 "최근 로그인" 조건(Secure password change)도 함께 채운다.
    const { error: checkError } = await this.client.auth.signInWithPassword({ email, password: current })
    if (checkError) {
      throw new UserFacingError(
        checkError.status === 429 ? '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' : '지금 비밀번호가 맞지 않습니다.',
      )
    }

    // temp_password: 운영자가 정해 준 비밀번호 표시(set-passwords 함수가 켠다). 스스로 바꿨으니 끈다.
    const { error } = await this.client.auth.updateUser({ password: next, data: { temp_password: false } })
    if (error) {
      if (error.code === 'same_password') throw new UserFacingError('지금 비밀번호와 다른 비밀번호를 넣어 주세요.')
      if (error.code === 'weak_password') throw new UserFacingError('더 길게 정해 주세요.')
      throw new UserFacingError('비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  async meetings(): Promise<Meeting[]> {
    const { data, error } = await this.client.from('meetings').select(MEETING_COLUMNS).order('date')
    if (error) throw failure(error)
    return (data as MeetingRow[]).map(toMeeting)
  }

  async myPresentMeetingIds(): Promise<Set<string>> {
    const me = await this.me()
    if (!me) throw new UserFacingError('다시 로그인해 주세요.')
    const { data, error } = await this.client.from('attendance').select('meeting_id').eq('member_id', me.id)
    if (error) throw failure(error)
    return new Set((data as { meeting_id: string }[]).map((row) => row.meeting_id))
  }

  async passwordIsTemporary(): Promise<boolean> {
    const { data } = await this.client.auth.getSession()
    return data.session?.user.user_metadata?.temp_password === true
  }

  async myRecords(): Promise<SwimRecord[]> {
    const me = await this.requireMe()
    const { data, error } = await this.client
      .from('records')
      .select(RECORD_COLUMNS)
      .eq('member_id', me.id)
      .order('date')
      .order('created_at')
    if (error) throw failure(error)
    return (data as RecordRow[]).map(toRecord)
  }

  async addRecord(input: RecordInput): Promise<void> {
    const me = await this.requireMe()
    const { error } = await this.client.from('records').insert({ member_id: me.id, source: 'self', ...recordFields(input) })
    if (error) throw failure(error)
  }

  async updateRecord(id: string, input: RecordInput): Promise<void> {
    // 남의 기록 · 모임 기록은 RLS 가 걸러 0행이 된다. 조용히 지나가지 않고 알린다.
    const { data, error } = await this.client
      .from('records')
      .update(recordFields(input))
      .eq('id', id)
      .eq('source', 'self')
      .select('id')
    if (error) throw failure(error)
    if (data.length === 0) throw new UserFacingError('고칠 수 없는 기록입니다. 모임 기록은 운영자가 고칩니다.')
  }

  async deleteRecord(id: string): Promise<void> {
    const { data, error } = await this.client.from('records').delete().eq('id', id).eq('source', 'self').select('id')
    if (error) throw failure(error)
    if (data.length === 0) throw new UserFacingError('지울 수 없는 기록입니다. 모임 기록은 운영자가 고칩니다.')
  }

  async myGoals(): Promise<Goal[]> {
    const me = await this.requireMe()
    const { data, error } = await this.client
      .from('goals')
      .select('stroke, distance, target_cs, updated_at')
      .eq('member_id', me.id)
    if (error) throw failure(error)
    return (data as GoalRow[]).map((row) => ({
      stroke: row.stroke,
      distance: row.distance,
      targetCs: row.target_cs,
      updatedAt: row.updated_at,
    }))
  }

  async saveGoal(event: SwimEvent, targetCs: number): Promise<void> {
    const me = await this.requireMe()
    const { error } = await this.client.from('goals').upsert(
      {
        member_id: me.id,
        stroke: event.stroke,
        distance: event.distance,
        target_cs: targetCs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'member_id,stroke,distance' },
    )
    if (error) throw failure(error)
  }

  async setOverrides(): Promise<SetOverride[]> {
    const { data, error } = await this.client.from('set_overrides').select('stroke, distance, bracket, plan, updated_at')
    if (error) throw failure(error)
    const overrides: SetOverride[] = []
    for (const row of data as OverrideRow[]) {
      // 모양이 어긋난 행은 버린다 — 그 구간은 공식 기본값으로 돌아간다.
      const plan = parsePlan(row.plan)
      if (plan) {
        overrides.push({ stroke: row.stroke, distance: row.distance, bracket: row.bracket, plan, updatedAt: row.updated_at })
      }
    }
    return overrides
  }

  async members(): Promise<Member[]> {
    const { data, error } = await this.client.from('members').select(MEMBER_COLUMNS).order('display_name')
    if (error) throw failure(error)
    return (data as MemberRow[]).map(toMember)
  }

  async createMember(input: NewMemberInput): Promise<Member> {
    const { data, error } = await this.client
      .from('members')
      .insert({
        display_name: input.displayName.trim(),
        role: input.role,
        joined_on: input.joinedOn,
        sex: input.sex,
        birth_year: input.birthYear,
      })
      .select(MEMBER_COLUMNS)
      .single<MemberRow>()
    if (error) {
      if (error.code === '23505') throw new UserFacingError('같은 이름이 이미 있습니다. 김민수A 처럼 구분해 주세요.')
      throw failure(error)
    }
    return toMember(data)
  }

  async setMemberActive(memberId: string, active: boolean): Promise<void> {
    const me = await this.me()
    if (me?.id === memberId && !active) throw new UserFacingError('자기 계정은 중지할 수 없습니다.')
    // 다시 켤 때 가입 여부에 따라 active / invited 로 돌린다.
    const { data: row } = await this.client.from('members').select('user_id').eq('id', memberId).single()
    const status = active ? (row?.user_id ? 'active' : 'invited') : 'inactive'
    const { error } = await this.client.from('members').update({ status }).eq('id', memberId)
    if (error) throw failure(error)
  }

  async issueInvite(memberId: string): Promise<IssuedInvite> {
    const { data, error } = await this.client.rpc('issue_invite', { p_member: memberId })
    if (error) throw failure(error)
    const row = (data as { code: string; expires_on: string }[])[0]
    if (!row) throw new UserFacingError('초대코드를 만들지 못했습니다.')
    return { code: row.code, expiresOn: row.expires_on }
  }

  async updateMemberProfile(memberId: string, profile: MemberProfile): Promise<void> {
    const { data, error } = await this.client
      .from('members')
      .update({ sex: profile.sex, birth_year: profile.birthYear })
      .eq('id', memberId)
      .select('id')
    if (error) throw failure(error)
    if (data.length === 0) throw new UserFacingError('운영자만 회원 정보를 고칠 수 있습니다.')
  }

  async setPasswords(entries: readonly PasswordEntry[]): Promise<PasswordResult[]> {
    // Auth 계정을 만들려면 service_role 이 필요하다 — Edge Function 이 운영자인지 확인하고 한다.
    const { data, error } = await this.client.functions.invoke<{ results: PasswordResult[] }>('set-passwords', {
      body: { entries },
    })
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null)
        if (body && typeof body.error === 'string') throw new UserFacingError(body.error)
      }
      throw new UserFacingError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
    if (!data || !Array.isArray(data.results)) throw new UserFacingError('비밀번호를 정하지 못했습니다.')
    return data.results
  }

  async createMeeting(input: MeetingInput): Promise<Meeting> {
    const { data, error } = await this.client
      .from('meetings')
      .insert({ date: input.date, kind: input.kind, place: input.place })
      .select(MEETING_COLUMNS)
      .single<MeetingRow>()
    if (error) throw failure(error)
    return toMeeting(data)
  }

  async setMeetingCancelled(meetingId: string, cancelled: boolean): Promise<void> {
    const { error } = await this.client.from('meetings').update({ cancelled }).eq('id', meetingId)
    if (error) throw failure(error)
  }

  async presentMemberIds(meetingId: string): Promise<Set<string>> {
    const { data, error } = await this.client.from('attendance').select('member_id').eq('meeting_id', meetingId)
    if (error) throw failure(error)
    return new Set((data as { member_id: string }[]).map((row) => row.member_id))
  }

  async saveAttendance(meetingId: string, presentMemberIds: readonly string[]): Promise<void> {
    const { error } = await this.client.rpc('save_attendance', {
      p_meeting: meetingId,
      p_present: [...presentMemberIds],
    })
    if (error) throw failure(error)
  }

  async meetingRecords(meetingId: string): Promise<SwimRecord[]> {
    const { data, error } = await this.client
      .from('records')
      .select(RECORD_COLUMNS)
      .eq('meeting_id', meetingId)
      .eq('source', 'meeting')
    if (error) throw failure(error)
    return (data as RecordRow[]).map(toRecord)
  }

  async saveMeetingRecords(meetingId: string, event: SwimEvent, entries: readonly MeetingEntry[]): Promise<void> {
    const { error } = await this.client.rpc('save_meeting_records', {
      p_meeting: meetingId,
      p_stroke: event.stroke,
      p_distance: event.distance,
      p_entries: entries.map((e) => ({ member_id: e.memberId, time_cs: e.timeCs })),
    })
    if (error) throw failure(error)
  }

  async saveSetOverride(event: SwimEvent, bracket: Bracket, plan: SetPlan): Promise<void> {
    const me = await this.requireMe()
    const { error } = await this.client.from('set_overrides').upsert(
      {
        stroke: event.stroke,
        distance: event.distance,
        bracket,
        plan,
        updated_by: me.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stroke,distance,bracket' },
    )
    if (error) throw failure(error)
  }

  async deleteSetOverride(event: SwimEvent, bracket: Bracket): Promise<void> {
    const { error } = await this.client
      .from('set_overrides')
      .delete()
      .eq('stroke', event.stroke)
      .eq('distance', event.distance)
      .eq('bracket', bracket)
    if (error) throw failure(error)
  }

  private async requireMe(): Promise<Member> {
    const me = await this.me()
    if (!me) throw new UserFacingError('다시 로그인해 주세요.')
    return me
  }
}

interface GoalRow {
  stroke: Goal['stroke']
  distance: Goal['distance']
  target_cs: number
  updated_at: string
}

interface OverrideRow {
  stroke: SetOverride['stroke']
  distance: SetOverride['distance']
  bracket: Bracket
  plan: unknown
  updated_at: string
}

const recordFields = (input: RecordInput) => ({
  stroke: input.stroke,
  distance: input.distance,
  time_cs: input.timeCs,
  date: input.date,
  note: input.note.trim(),
})

/** DB 함수가 올린 한국어 메시지는 그대로, 나머지는 일반 문구로. */
function failure(error: { code?: string; message: string }): UserFacingError {
  if (error.code === '42501' || error.code === 'P0001') return new UserFacingError(error.message)
  if (error.code === '23514') return new UserFacingError('넣은 값을 확인해 주세요.')
  return new UserFacingError('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
}
