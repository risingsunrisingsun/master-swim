/**
 * 등급 배정.
 *
 * 두 축을 따로 통과시킨다 — 기록 축이 세트의 **강도**를, 훈련량 축이 **분량**을 정한다.
 * 기록이 고급인데 주 2회 나오는 회원에게 고급 분량을 주면 완주하지 못하거나 다친다.
 *
 * 기록 축은 연령대별 분위수 표로 가는 것이 목표지만(3차), 그 표가 들어오기 전까지는
 * 수영계 통용 절대 구간으로 대체한다. 여기 상수는 그 임시값이다.
 */
import type { Distance, Level, RaceEvent, Sex, Stroke, TrainingLoad } from './types'

export const LEVEL_ORDER: readonly Level[] = ['beginner', 'intermediate', 'advanced', 'elite']

/**
 * 100m 자유형 · 25m 단수로 · 남자 기준 등급 상한 (centisecond).
 * 이 구간을 넘어서면 한 단계 아래로 떨어진다.
 */
const MEN_100_FREE_CEILING: Readonly<Record<Exclude<Level, 'beginner'>, number>> = {
  elite: 6700, // 1:07.00
  advanced: 8000, // 1:20.00
  intermediate: 9800, // 1:38.00
}

/**
 * 여자 기록을 남자 기준으로 정규화하는 계수.
 * 수영의 성별 기록 격차는 종목 전반에서 대략 11% 다.
 */
const FEMALE_NORMALISER = 1.11

/**
 * 자유형 대비 영법별 기록 배율 (100m).
 *
 * 세계기록 비율에서 출발했으나 접영은 마스터즈 쪽으로 넓혔다 — 엘리트는 접영이
 * 배영보다 빠르지만, 100 접영은 기술 부하가 커서 동호인에게는 반대로 나타난다.
 */
const STROKE_RATIO: Readonly<Record<Stroke, number>> = {
  free: 1.0,
  back: 1.1,
  fly: 1.14,
  breast: 1.24,
  im: 1.15,
}

/**
 * 거리 환산 지수. `T₂ = T₁ × (d₂/d₁)^n`
 *
 * 장거리용 Riegel 값(1.06)은 스프린트에서 어긋난다 — 실제 100m 기록은 50m 의 약 2.14배로
 * 나타나므로(엘리트 44.8/20.9, 동호인은 더 벌어진다) `log₂(2.14) ≈ 1.10` 을 쓴다.
 * 1.06 을 쓰면 50m·25m 종목의 등급이 후하게 나온다.
 */
const DISTANCE_EXPONENT = 1.1

/** 어떤 기록이든 '100m 자유형 남자 상당' 한 숫자로 접어서 구간과 비교한다. */
export function freeEquivalent100(recordCs: number, event: RaceEvent, sex: Sex): number {
  const per100 = recordCs * Math.pow(100 / event.distance, DISTANCE_EXPONENT)
  const strokeAdjusted = per100 / STROKE_RATIO[event.stroke]
  return sex === 'F' ? strokeAdjusted / FEMALE_NORMALISER : strokeAdjusted
}

export function recordLevel(recordCs: number, event: RaceEvent, sex: Sex): Level {
  const equivalent = freeEquivalent100(recordCs, event, sex)

  if (equivalent <= MEN_100_FREE_CEILING.elite) return 'elite'
  if (equivalent <= MEN_100_FREE_CEILING.advanced) return 'advanced'
  if (equivalent <= MEN_100_FREE_CEILING.intermediate) return 'intermediate'
  return 'beginner'
}

/**
 * 훈련량 축. 주간 횟수와 주간 총거리를 각각 등급으로 매긴 뒤 **낮은 쪽**을 쓴다.
 * 주 6회 나와도 세션당 1,000m 면 고강도 세트를 감당하지 못한다.
 */
export function loadLevel(load: TrainingLoad): Level {
  const weeklyMeters = load.sessionsPerWeek * load.metersPerSession

  const bySessions: Level =
    load.sessionsPerWeek >= 5
      ? 'elite'
      : load.sessionsPerWeek >= 4
        ? 'advanced'
        : load.sessionsPerWeek >= 3
          ? 'intermediate'
          : 'beginner'

  const byMeters: Level =
    weeklyMeters >= 15_000
      ? 'elite'
      : weeklyMeters >= 9_000
        ? 'advanced'
        : weeklyMeters >= 4_000
          ? 'intermediate'
          : 'beginner'

  return LEVEL_ORDER.indexOf(bySessions) <= LEVEL_ORDER.indexOf(byMeters) ? bySessions : byMeters
}

export interface Grading {
  /** 세트의 강도를 정한다. */
  intensity: Level
  /** 세트의 분량과 주간 세션 수를 정한다. */
  volume: Level
  /** 두 축이 2단계 이상 벌어졌을 때의 안내. 없으면 null. */
  mismatch: string | null
}

export function grade(recordCs: number, event: RaceEvent, sex: Sex, load: TrainingLoad): Grading {
  const intensity = recordLevel(recordCs, event, sex)
  const volume = loadLevel(load)

  const gap = LEVEL_ORDER.indexOf(intensity) - LEVEL_ORDER.indexOf(volume)

  const mismatch =
    gap >= 2
      ? '기록에 비해 물에 들어가는 횟수가 적습니다. 세트 강도는 기록에 맞추되 분량은 낮춰서 나갑니다 — 기록을 더 줄이려면 훈련 횟수를 늘리는 것이 가장 큰 변수입니다.'
      : gap <= -2
        ? '훈련량에 비해 기록이 아직 따라오지 않았습니다. 분량을 늘리는 것보다 페이스와 기술에 집중할 단계입니다.'
        : null

  return { intensity, volume, mismatch }
}

/** 기록 구간의 경계값을 화면에 그대로 보여주기 위해 노출한다. */
export function levelBoundaries(
  event: RaceEvent,
  sex: Sex,
): { level: Level; ceilingCs: number | null }[] {
  const scale = (ceiling: number): number => {
    const strokeAdjusted = ceiling * STROKE_RATIO[event.stroke]
    const sexAdjusted = sex === 'F' ? strokeAdjusted * FEMALE_NORMALISER : strokeAdjusted
    return sexAdjusted / Math.pow(100 / event.distance, DISTANCE_EXPONENT)
  }

  return [
    { level: 'elite', ceilingCs: scale(MEN_100_FREE_CEILING.elite) },
    { level: 'advanced', ceilingCs: scale(MEN_100_FREE_CEILING.advanced) },
    { level: 'intermediate', ceilingCs: scale(MEN_100_FREE_CEILING.intermediate) },
    { level: 'beginner', ceilingCs: null },
  ]
}

/** 카탈로그 미리보기용 — 지원 거리 목록. */
export const DISTANCES: readonly Distance[] = [25, 50, 100]
