/**
 * 기록이 어디쯤인지 한 숫자로 보여준다.
 *
 * **아직 백분위가 아니다.** 진짜 백분위를 내려면 국내 마스터즈 대회 기록에서 뽑은
 * 연령대×종목별 분위수 표가 필요하고, 그건 아직 수집하지 않았다(CONTEXT.md · 미해결).
 * 지금은 `grading.ts` 의 절대 구간을 보간한 값이며, 화면에 그 사실을 그대로 밝힌다.
 *
 * 분위수 표가 들어오면 `standing()` 의 본문만 갈아끼우면 된다 —
 * 호출부는 `Standing` 만 알고 있다.
 */
import { freeEquivalent100, LEVEL_ORDER, recordLevel } from './grading'
import type { Level, RaceEvent, Sex } from './types'

export interface Standing {
  /** 0~100. 클수록 빠르다. */
  position: number
  level: Level
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
  '등급 구간 대비 위치입니다. 국내 마스터즈 백분위가 아닙니다 — 분위수 표를 아직 모으지 않았습니다.'

export function standing(recordCs: number, event: RaceEvent, sex: Sex): Standing {
  const equivalent = freeEquivalent100(recordCs, event, sex)
  const level = recordLevel(recordCs, event, sex)

  const first = ANCHORS[0]!
  const last = ANCHORS.at(-1)!
  if (equivalent <= first.equivalentCs) return { position: 100, level, basis: STANDING_BASIS }
  if (equivalent >= last.equivalentCs) return { position: 0, level, basis: STANDING_BASIS }

  for (let i = 1; i < ANCHORS.length; i++) {
    const lower = ANCHORS[i - 1]!
    const upper = ANCHORS[i]!
    if (equivalent > upper.equivalentCs) continue

    const ratio = (equivalent - lower.equivalentCs) / (upper.equivalentCs - lower.equivalentCs)
    const position = lower.position + ratio * (upper.position - lower.position)
    return { position: Math.round(position), level, basis: STANDING_BASIS }
  }

  return { position: 0, level, basis: STANDING_BASIS }
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
