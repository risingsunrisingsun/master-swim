/**
 * 앱이 보는 저장소 경계(ADR-0010).
 *
 * 구현은 둘이다 — 운영용 `SupabaseBackend`, 서버 없이 화면을 검토하는 `LocalBackend`.
 * 화면 코드는 어느 쪽인지 모른다. 권한 검사는 **구현 쪽 책임**이다 — Supabase 는 RLS 가,
 * LocalBackend 는 같은 규칙을 코드로 흉내 낸다. 화면이 버튼을 숨기는 것은 편의일 뿐이다.
 */
import type { Meeting, MeetingInput, Member } from '../core/types'

/** 화면에 그대로 띄울 수 있는 문구를 담은 오류. */
export class UserFacingError extends Error {}

export interface NewMemberInput {
  displayName: string
  role: 'member' | 'admin'
  joinedOn: string
}

export interface IssuedInvite {
  /** 정규화된 8자. 이 값은 다시 볼 수 없다 — DB 에는 해시만 남는다. */
  code: string
  expiresOn: string
}

export interface Backend {
  /** 데모 모드면 true. 화면 위에 띠를 붙인다. */
  readonly demo: boolean

  /** 로그인 상태면 그 회원. 비활성 회원은 null. */
  me(): Promise<Member | null>
  signIn(displayName: string, password: string): Promise<Member>
  /** 초대코드로 가입하거나, 이미 가입한 회원이면 비밀번호를 바꾼다. 로그인까지 마친다. */
  redeemInvite(code: string, password: string): Promise<Member>
  signOut(): Promise<void>

  /** 모든 정기모임. 30명 동호회의 몇 년치라 전부 받아도 작다. */
  meetings(): Promise<Meeting[]>
  /** 내가 참석으로 체크된 모임 id. */
  myPresentMeetingIds(): Promise<Set<string>>

  // ── 운영자 전용 ─────────────────────────────────────────
  members(): Promise<Member[]>
  createMember(input: NewMemberInput): Promise<Member>
  setMemberActive(memberId: string, active: boolean): Promise<void>
  issueInvite(memberId: string): Promise<IssuedInvite>

  createMeeting(input: MeetingInput): Promise<Meeting>
  setMeetingCancelled(meetingId: string, cancelled: boolean): Promise<void>
  /** 그 모임에 참석으로 체크된 회원 id. */
  presentMemberIds(meetingId: string): Promise<Set<string>>
  /** 체크 결과를 통째로 저장하고 모임을 "집계됨"으로 표시한다. */
  saveAttendance(meetingId: string, presentMemberIds: readonly string[]): Promise<void>
}
