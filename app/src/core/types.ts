/**
 * v2 의 도메인 타입. 저장소(Supabase · localStorage)와 무관하게 앱이 보는 모양이다.
 *
 * 날짜는 전부 `YYYY-MM-DD` 문자열이다. 정기모임은 날짜 단위로 열리고, 시간대가 끼면
 * 자정 근처 모임이 다른 달로 넘어간다.
 */

export type Role = 'member' | 'admin'

/** 초대만 받고 아직 가입 전 · 사용 중 · 탈퇴/정지. */
export type MemberStatus = 'invited' | 'active' | 'inactive'

export interface Member {
  id: string
  /** 로그인 이름이자 화면 이름. 유일하다 — 동명이인은 운영자가 구분한다(ADR-0011). */
  displayName: string
  role: Role
  status: MemberStatus
  /** 이 날 이전 모임은 달성률 분모에 넣지 않는다. */
  joinedOn: string
  /** 운영자가 넣는다. 기존 회원은 비어 있다 — 세트는 남자 기준, 상위 % 는 숨긴다. */
  sex: Sex | null
  /** 마스터즈 연령부 계산용. 나이는 해마다 바뀌므로 출생연도를 둔다. */
  birthYear: number | null
}

export type Sex = 'M' | 'F'

export const SEX_LABEL: Record<Sex, string> = { M: '남', F: '여' }

/** 마스터즈 나이 — 그해 12월 31일 기준. */
export function mastersAge(birthYear: number, today: string): number {
  return Number(today.slice(0, 4)) - birthYear
}

/** 정기 훈련 · 기록회. 둘 다 달성률에 들어간다(PRD-0001 §11 열린 질문 2). */
export type MeetingKind = 'training' | 'record'

export interface Meeting {
  id: string
  date: string
  kind: MeetingKind
  place: string
  cancelled: boolean
  /**
   * 운영자가 출석을 저장한 시각. 이것이 비어 있으면 그 모임은 **집계 전**이다 —
   * 지난 모임이라도 결석으로 치지 않는다. 운영자가 하루 늦게 체크했다고
   * 전원의 달성률이 하루 동안 떨어지면 안 된다.
   */
  checkedAt: string | null
}

export interface MeetingInput {
  date: string
  kind: MeetingKind
  place: string
}

export const MEETING_KIND_LABEL: Record<MeetingKind, string> = {
  training: '정기 훈련',
  record: '기록회',
}

// ── 기록 (기능2) ─────────────────────────────────────────────

/** 개인혼영은 기록 보관만 한다 — 세트 처방은 네 영법만(PRD-0001 §3). */
export type Stroke = 'free' | 'back' | 'breast' | 'fly' | 'im'
/** 25m 단수 수영장. 25m 는 기록 보관만, 세트는 50 · 100m. */
export type Distance = 25 | 50 | 100

export interface SwimEvent {
  stroke: Stroke
  distance: Distance
}

export const STROKE_LABEL: Record<Stroke, string> = {
  free: '자유형',
  back: '배영',
  breast: '평영',
  fly: '접영',
  im: '개인혼영',
}

/** 기록을 남길 수 있는 종목. 개인혼영은 100m 만. */
export const RECORD_EVENTS: readonly SwimEvent[] = [
  ...(['free', 'back', 'breast', 'fly'] as const).flatMap((stroke) =>
    ([25, 50, 100] as const).map((distance) => ({ stroke, distance })),
  ),
  { stroke: 'im', distance: 100 },
]

/** 개인 입력 · 정기모임 기록회. 같은 차트에 겹치되 출처를 가른다. */
export type RecordSource = 'self' | 'meeting'

export interface SwimRecord extends SwimEvent {
  id: string
  memberId: string
  /** 1/100초 정수. 부동소수 금지(PRD-0001 §6). */
  timeCs: number
  date: string
  source: RecordSource
  /** 운영자 입력이면 그 모임. */
  meetingId: string | null
  note: string
}

export interface RecordInput extends SwimEvent {
  timeCs: number
  date: string
  note: string
}

/** 회원이 세트 화면에서 정한 종목별 목표. 홈의 "목표까지 남은 초" 가 이것을 본다. */
export interface Goal extends SwimEvent {
  targetCs: number
  updatedAt: string
}
