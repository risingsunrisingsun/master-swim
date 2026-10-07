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
