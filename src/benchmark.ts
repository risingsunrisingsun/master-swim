/**
 * 기록이 어디쯤인지 한 숫자로 보여준다.
 *
 * 두 경로가 있고, 어느 쪽을 썼는지 `source` 와 `basis` 로 항상 밝힌다(ADR-0006).
 *
 * 1. **분포 기반** — 국내 마스터즈 기록 분포가 있는 종목이면 실제 백분위를 낸다.
 *    분포는 그래프에서 읽은 추정치라 오차가 있다(`distributions.ts` 참조).
 * 2. **등급 구간 기반** — 분포가 없는 종목의 대체 경로. 백분위가 아니다.
 */
import { decadeOf, findDistribution, percentileBeaten } from './distributions'
import { freeEquivalent100, LEVEL_ORDER, recordLevel } from './grading'
import type { AgeGroup, Level, RaceEvent, Sex } from './types'

export type StandingSource = 'distribution' | 'level-band'

export interface Standing {
  /** 이긴 사람의 비율 0~100. 클수록 빠르다. 막대 길이에 쓴다. */
  position: number
  /**
   * 상위 몇 %인가. `100 − position` 이며 작을수록 빠르다.
   * 방향이 뒤집히기 쉬운 값이라 계산해서 함께 돌려준다 — 화면이 다시 뒤집지 않게.
   */
  topPercent: number
  level: Level
  source: StandingSource
  /** 표본 수. 분포 기반일 때만 있다. */
  sampleSize?: number
  /** 이 숫자의 출처. 화면에 반드시 함께 띄운다. */
  basis: string
}

/**
 * 100m 자유형 남자 상당 기록의 구간 경계와, 각 경계에 대응시킬 위치 점수.
 * 경계값은 `grading.ts` 의 등급 상한과 같다.
 */
const ANCHORS: readonly { equivalentCs: number; position: number }[] = [
  { equivalentCs: 5800, position: 100 },
  { equivalentCs: 6700, position: 90 }, // 최상급 상한
  { equivalentCs: 8000, position: 70 }, // 고급 상한
  { equivalentCs: 9800, position: 40 }, // 중급 상한
  { equivalentCs: 14000, position: 0 },
]

export const STANDING_BASIS =
  '등급 구간 대비 위치입니다. 국내 마스터즈 백분위가 아닙니다 — 이 종목의 기록 분포를 아직 모으지 않았습니다.'

/** 등급 구간 보간. 분포가 없는 종목의 대체 경로다. */
function levelBandStanding(recordCs: number, event: RaceEvent, sex: Sex): Standing {
  const equivalent = freeEquivalent100(recordCs, event, sex)
  const level = recordLevel(recordCs, event, sex)

  const at = (position: number): Standing => ({
    position,
    topPercent: 100 - position,
    level,
    source: 'level-band',
    basis: STANDING_BASIS,
  })

  const first = ANCHORS[0]!
  const last = ANCHORS.at(-1)!
  if (equivalent <= first.equivalentCs) return at(100)
  if (equivalent >= last.equivalentCs) return at(0)

  for (let i = 1; i < ANCHORS.length; i++) {
    const lower = ANCHORS[i - 1]!
    const upper = ANCHORS[i]!
    if (equivalent > upper.equivalentCs) continue

    const ratio = (equivalent - lower.equivalentCs) / (upper.equivalentCs - lower.equivalentCs)
    return at(Math.round(lower.position + ratio * (upper.position - lower.position)))
  }

  return at(0)
}

/**
 * 분포가 있으면 실제 백분위를, 없으면 등급 구간 위치를 돌려준다.
 *
 * `ageGroup` 을 주지 않으면 분포를 찾을 수 없으므로 대체 경로로 간다 —
 * 연령을 모르는 자리에서 전국 백분위를 말하는 것은 의미가 없다.
 */
export function standing(
  recordCs: number,
  event: RaceEvent,
  sex: Sex,
  ageGroup?: AgeGroup,
): Standing {
  if (ageGroup) {
    const dist = findDistribution(event.stroke, event.distance, sex, decadeOf(ageGroup))
    if (dist) {
      const position = Math.round(percentileBeaten(recordCs, dist))
      return {
        position,
        topPercent: 100 - position,
        level: recordLevel(recordCs, event, sex),
        source: 'distribution',
        sampleSize: dist.total,
        basis: `국내 마스터즈 ${dist.decade}대 ${dist.sex === 'M' ? '남자' : '여자'} 기록 ${dist.total.toLocaleString('ko-KR')}건의 분포와 비교한 값입니다. 분포를 그래프에서 읽어 넣었으므로 ±1초 정도의 오차가 있습니다.`,
      }
    }
  }

  return levelBandStanding(recordCs, event, sex)
}

/** 등급이 한 단계 오르려면 얼마나 줄여야 하는지. null 이면 이미 최상급이다. */
export function toNextLevel(
  recordCs: number,
  event: RaceEvent,
  sex: Sex,
): { level: Level; gapCs: number } | null {
  const current = recordLevel(recordCs, event, sex)
  const index = LEVEL_ORDER.indexOf(current)
  if (index === LEVEL_ORDER.length - 1) return null

  const next = LEVEL_ORDER[index + 1]!

  // 등급 경계는 시간축에서 단조라 이분탐색으로 찾는다.
  let fast = 0
  let slow = recordCs
  for (let i = 0; i < 40; i++) {
    const mid = (fast + slow) / 2
    if (LEVEL_ORDER.indexOf(recordLevel(mid, event, sex)) >= LEVEL_ORDER.indexOf(next)) {
      fast = mid
    } else {
      slow = mid
    }
  }

  return { level: next, gapCs: Math.max(0, recordCs - fast) }
}
