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

/**
 * 신체 데이터. **기기를 벗어나지 않는다** (ADR-0002).
 * 전부 선택 입력이고, 없으면 식단만 잠긴다.
 */
export interface Body {
  heightCm: number
  weightKg: number
  /**
   * 체지방률(%). 아는 회원만 넣는다.
   *
   * 있으면 기초대사량이 제지방량 기준(Katch-McArdle)으로 계산된다 — 같은 체중이라도
   * 근육이 많으면 더 쓴다. 없으면 키·나이로 어림하는 기존 식을 그대로 쓴다.
   */
  bodyFatPercent?: number
}

/**
 * 회원이 고르는 목적. 무엇을 얻으려고 왔는가.
 *
 * 세션의 **순서**만 바꾼다(`plan.ts`). 어느 목적을 골라도 다섯 성격이 모두 한 주에
 * 들어가고 고른 것이 앞으로 온다 — 주 2회 나오는 회원은 앞의 둘만 받는다.
 * 하나만 남기지 않는 이유는 한 가지만 파면 나머지가 무너지기 때문이다.
 */
export type Purpose = 'faster' | 'form' | 'breathing' | 'injury'

export const PURPOSE_LABEL: Record<Purpose, string> = {
  faster: '기록 단축',
  form: '영법 교정',
  breathing: '호흡',
  injury: '부상 예방',
}

/**
 * 어떤 방식으로 훈련하고 싶은가. 목적과 층위가 다르다 — 이쪽은 수단이다.
 *
 * **세션 안의 순서는 바꾸지 않는다.** 지상훈련이 수영 뒤에 오는 것은 취향이 아니라
 * 훈련 순서다(다리가 지친 뒤에 킥과 턴이 무너진다 · `plan.ts`). 이 선택이 정하는 것은
 * 세션에 **어떤 지상훈련이 붙느냐**다.
 */
export type SessionFormat = 'pool' | 'dryland' | 'band'

export const FORMAT_LABEL: Record<SessionFormat, string> = {
  pool: '수중 세트 위주',
  dryland: '지상훈련도 챙기기',
  band: '밴드 위주',
}

export interface Profile {
  ageGroup: AgeGroup
  sex: Sex
  goal: Goal
  load: TrainingLoad
  body?: Body
  /**
   * 마법사에서 고른 목적과 형식.
   *
   * **선택 필드다.** 마법사 이전에 저장한 프로필에는 없고, 없으면 각각 기본값
   * (`faster` · `pool`)으로 본다. 그래서 `storage.ts` 의 버전을 올리지 않았다.
   */
  purpose?: Purpose
  format?: SessionFormat
  /**
   * 계산된 등급을 회원이 옮긴 경우. 없으면 계산값 그대로 쓴다.
   *
   * 한 단계까지만 열려 있다(`view.ts`). 자가 선택으로 돌아가는 것이 아니라,
   * 계산이 몸 상태를 못 따라오는 경우에 대는 비상구다.
   */
  levelAdjust?: { intensity: Level; volume: Level }
}

/** 본인이 직접 남기는 기록 한 줄. 시계열 그래프의 재료다. */
export interface RecordEntry {
  /** YYYY-MM-DD */
  date: string
  event: RaceEvent
  timeCs: number
  /** 대회 기록인지 훈련 중 측정인지 */
  meet?: boolean
  note?: string
}

/** 연령부의 중간 나이. 기초대사량 계산에 쓴다. */
export const AGE_GROUP_MIDPOINT: Record<AgeGroup, number> = {
  '25-29': 27,
  '30-34': 32,
  '35-39': 37,
  '40-44': 42,
  '45-49': 47,
  '50-54': 52,
  '55-59': 57,
  '60-64': 62,
  '65-69': 67,
  '70+': 72,
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
