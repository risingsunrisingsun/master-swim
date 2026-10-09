/**
 * 앱이 보는 저장소 경계(ADR-0010).
 *
 * 구현은 둘이다 — 운영용 `SupabaseBackend`, 서버 없이 화면을 검토하는 `LocalBackend`.
 * 화면 코드는 어느 쪽인지 모른다. 권한 검사는 **구현 쪽 책임**이다 — Supabase 는 RLS 가,
 * LocalBackend 는 같은 규칙을 코드로 흉내 낸다. 화면이 버튼을 숨기는 것은 편의일 뿐이다.
 */
import type { Bracket, SetOverride, SetPlan } from '../core/sets'
import type {
  Goal,
  Meeting,
  MeetingInput,
  Member,
  RecordInput,
  Role,
  Rsvp,
  Sex,
  SwimEvent,
  SwimRecord,
} from '../core/types'

/** 화면에 그대로 띄울 수 있는 문구를 담은 오류. */
export class UserFacingError extends Error {}

export interface NewMemberInput {
  displayName: string
  role: 'member' | 'admin'
  joinedOn: string
  sex: Sex | null
  birthYear: number | null
}

export interface MemberProfile {
  /** 로그인 이름. 바꾸면 그 회원은 다음부터 새 이름으로 들어온다(비밀번호는 그대로). */
  displayName: string
  role: Role
  sex: Sex | null
  birthYear: number | null
}

/** 운영자가 정해 주는 초기 비밀번호 한 줄. */
export interface PasswordEntry {
  memberId: string
  password: string
}

/** 한 명씩의 결과. 일괄로 보내므로 일부만 실패할 수 있다. */
export interface PasswordResult {
  memberId: string
  /** null 이면 성공 — 그 이름과 비밀번호로 바로 로그인된다. */
  error: string | null
}

export interface IssuedInvite {
  /** 정규화된 8자. 이 값은 다시 볼 수 없다 — DB 에는 해시만 남는다. */
  code: string
  expiresOn: string
}

/** 모임 기록 한 줄. 빈 칸(기록 없음)은 보내지 않는다. */
export interface MeetingEntry {
  memberId: string
  timeCs: number
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
  /** 로그인한 본인의 비밀번호 바꾸기. 지금 비밀번호를 한 번 더 확인한다. */
  changePassword(current: string, next: string): Promise<void>
  /** 운영자가 정해 준 비밀번호를 아직 쓰는 중이면 true. 홈이 바꾸라고 알린다. */
  passwordIsTemporary(): Promise<boolean>

  /** 모든 정기모임. 30명 동호회의 몇 년치라 전부 받아도 작다. */
  meetings(): Promise<Meeting[]>
  /** 내가 참석으로 체크된 모임 id. */
  myPresentMeetingIds(): Promise<Set<string>>
  /** 내 참석 여부 답. 모임 id → 참석(true) · 불참(false). 답하지 않은 모임은 없다. */
  myRsvps(): Promise<Map<string, boolean>>
  /** 참석 여부 답하기. null 이면 답을 지운다. 지난 모임 · 취소된 모임은 거절한다. */
  setRsvp(meetingId: string, going: boolean | null): Promise<void>

  /** 내 기록 전부(개인 입력 + 모임 기록). */
  myRecords(): Promise<SwimRecord[]>
  /** 개인 입력. 모임 기록은 운영자만 넣는다. */
  addRecord(input: RecordInput): Promise<void>
  /** 개인 입력만 고치고 지울 수 있다. */
  updateRecord(id: string, input: RecordInput): Promise<void>
  deleteRecord(id: string): Promise<void>

  myGoals(): Promise<Goal[]>
  saveGoal(event: SwimEvent, targetCs: number): Promise<void>

  /** 코치가 덮어쓴 세트 묶음. 회원 누구나 읽는다. */
  setOverrides(): Promise<SetOverride[]>

  // ── 운영자 전용 ─────────────────────────────────────────
  members(): Promise<Member[]>
  createMember(input: NewMemberInput): Promise<Member>
  setMemberActive(memberId: string, active: boolean): Promise<void>
  issueInvite(memberId: string): Promise<IssuedInvite>
  /** 이름 · 역할 · 성별 · 출생연도. 운영자는 자기 역할을 바꿀 수 없다 — 운영자가 0명이 되지 않게. */
  updateMemberProfile(memberId: string, profile: MemberProfile): Promise<void>
  /**
   * 운영자가 비밀번호를 직접 정한다. 가입 전 회원은 계정이 바로 생기고, 가입한 회원은
   * 비밀번호가 바뀐다. 그 회원의 안 쓴 초대코드는 무효가 된다.
   */
  setPasswords(entries: readonly PasswordEntry[]): Promise<PasswordResult[]>

  createMeeting(input: MeetingInput): Promise<Meeting>
  setMeetingCancelled(meetingId: string, cancelled: boolean): Promise<void>
  /** 날짜 · 종류 · 장소를 고친다. 날짜가 바뀌면 그 모임의 기록 날짜도 따라간다. */
  updateMeeting(meetingId: string, input: MeetingInput): Promise<void>
  /**
   * 모임을 아주 지운다. 출석 · 참석 여부 답은 함께 지워지고, 그 모임의 기록은 남되
   * 모임 연결만 끊긴다. 지난 모임의 기록을 남기고 싶으면 지우지 말고 취소한다.
   */
  deleteMeeting(meetingId: string): Promise<void>
  /** 그 모임들에 회원이 미리 한 답(운영자). */
  rsvpsFor(meetingIds: readonly string[]): Promise<Rsvp[]>
  /** 그 모임에 참석으로 체크된 회원 id. */
  presentMemberIds(meetingId: string): Promise<Set<string>>
  /** 체크 결과를 통째로 저장하고 모임을 "집계됨"으로 표시한다. */
  saveAttendance(meetingId: string, presentMemberIds: readonly string[]): Promise<void>

  /** 회원 전원의 기록 — 운영자 내려받기용. */
  allRecords(): Promise<SwimRecord[]>
  /** 그 모임에서 운영자가 넣은 기록. */
  meetingRecords(meetingId: string): Promise<SwimRecord[]>
  /** 그 모임 · 그 종목의 기록을 통째로 바꾼다. */
  saveMeetingRecords(meetingId: string, event: SwimEvent, entries: readonly MeetingEntry[]): Promise<void>

  saveSetOverride(event: SwimEvent, bracket: Bracket, plan: SetPlan): Promise<void>
  /** 공식 기본값으로 되돌린다. */
  deleteSetOverride(event: SwimEvent, bracket: Bracket): Promise<void>
}
