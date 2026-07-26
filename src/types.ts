/** 이 앱이 다루는 종목·거리·등급의 정의. 범위는 CONTEXT.md 를 따른다. */

/** 지원 영법. `im` 은 기록 보관 전용 — 진단·처방 대상이 아니다. */
export type Stroke = 'free' | 'back' | 'breast' | 'fly' | 'im'

/** 지원 거리. 4영법은 25/50/100, IM 은 100 만. */
export type Distance = 25 | 50 | 100

export type Sex = 'M' | 'F'

/** 훈련 등급. 기록 축과 훈련량 축을 모두 통과한 결과. */
export type Level = 'beginner' | 'intermediate' | 'advanced' | 'elite'

export interface RaceEvent {
  stroke: Stroke
  distance: Distance
}

/** 5세 단위 연령부. 마스터즈 대회가 이 단위로 나뉘므로 생년월일 대신 이것만 받는다. */
export type AgeGroup =
  | '25-29' | '30-34' | '35-39' | '40-44' | '45-49'
  | '50-54' | '55-59' | '60-64' | '65-69' | '70+'

export interface Goal {
  event: RaceEvent
  /** 목표기록 (centisecond) */
  targetCs: number
  /** 현재 최고기록 (centisecond) */
  currentCs: number
  /** 목표 대회 날짜 (YYYY-MM-DD). 없으면 무기한. */
  meetDate?: string
}

/** 회원이 실제로 물에 들어가는 빈도 — 등급의 '분량' 축. */
export interface TrainingLoad {
  /** 주간 훈련 횟수 */
  sessionsPerWeek: number
  /** 세션당 평균 거리 (m) */
  metersPerSession: number
}

export interface Profile {
  ageGroup: AgeGroup
  sex: Sex
  goal: Goal
  load: TrainingLoad
}

export const STROKE_LABEL: Record<Stroke, string> = {
  free: '자유형',
  back: '배영',
  breast: '평영',
  fly: '접영',
  im: '개인혼영',
}

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: '초급',
  intermediate: '중급',
  advanced: '고급',
  elite: '최상급',
}
