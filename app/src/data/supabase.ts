/**
 * 운영 저장소(ADR-0010). 권한은 DB 의 RLS 가 판정하고, 여기서는 모양만 옮긴다.
 * 스키마는 `app/supabase/migrations/` 에 있다.
 */
import { createClient, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import type { Meeting, MeetingInput, Member } from '../core/types'
import { type Backend, type IssuedInvite, type NewMemberInput, UserFacingError } from './backend'

const MEMBER_COLUMNS = 'id, display_name, role, status, joined_on'
const MEETING_COLUMNS = 'id, date, kind, place, cancelled, checked_at'

interface MemberRow {
  id: string
  display_name: string
  role: Member['role']
  status: Member['status']
  joined_on: string
}

interface MeetingRow {
  id: string
  date: string
  kind: Meeting['kind']
  place: string
  cancelled: boolean
  checked_at: string | null
}

const toMember = (row: MemberRow): Member => ({
  id: row.id,
  displayName: row.display_name,
  role: row.role,
  status: row.status,
  joinedOn: row.joined_on,
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

  async members(): Promise<Member[]> {
    const { data, error } = await this.client.from('members').select(MEMBER_COLUMNS).order('display_name')
    if (error) throw failure(error)
    return (data as MemberRow[]).map(toMember)
  }

  async createMember(input: NewMemberInput): Promise<Member> {
    const { data, error } = await this.client
      .from('members')
      .insert({ display_name: input.displayName.trim(), role: input.role, joined_on: input.joinedOn })
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
}

/** DB 함수가 올린 한국어 메시지는 그대로, 나머지는 일반 문구로. */
function failure(error: { code?: string; message: string }): UserFacingError {
  if (error.code === '42501' || error.code === 'P0001') return new UserFacingError(error.message)
  return new UserFacingError('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
}
