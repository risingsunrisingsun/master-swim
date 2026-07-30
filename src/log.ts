/**
 * 훈련 로그와 목표 검증.
 *
 * 여기가 앱의 고리를 닫는 자리다. 지금까지는 처방만 하고 결과를 받지 않았는데,
 * USRPT 는 **실패 지점 자체가 목표가 이른지 알려주는 측정값**이라는 전제로 굴러간다
 * (ADR-0003). 그 측정값을 받지 않으면 목표기록을 검증할 방법이 없다.
 *
 * 입력은 한 줄이다 — 계획 몇 개 중 몇 개를 페이스대로 지켰나.
 */

export interface SetLog {
  /** YYYY-MM-DD */
  date: string
  methodId: string
  plannedReps: number
  /** 목표 페이스를 지킨 반복 수. 실패는 이 다음 번째에서 났다. */
  completedReps: number
}

/** 판정에 쓰는 최근 시도 수. 하루 컨디션에 흔들리지 않을 최소치. */
export const WINDOW = 3

/** 이 아래면 목표가 이르다고 본다. */
const TOO_HARD_RATIO = 0.6
/** 이 위로 계속 나오면 목표를 당길 때가 됐다. */
const READY_RATIO = 0.95

export type VerdictKind = 'unknown' | 'too-hard' | 'on-track' | 'ready'

export interface Verdict {
  kind: VerdictKind
  attempts: number
  /** 최근 시도의 평균 완주율 0~1. 시도가 없으면 0. */
  ratio: number
  message: string
}

/** 최근 것이 뒤에 오도록 날짜 오름차순으로 둔다. */
export function forMethod(logs: readonly SetLog[], methodId: string): SetLog[] {
  return logs
    .filter((log) => log.methodId === methodId)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * 목표 페이스가 지금 몸에 맞는지 판정한다.
 *
 * 세 번 이상 시도해야 판정한다 — 한 번 무너진 것은 컨디션이고,
 * 세 번 연속 무너지면 목표다.
 */
export function verdict(logs: readonly SetLog[], methodId: string): Verdict {
  const recent = forMethod(logs, methodId).slice(-WINDOW)

  if (recent.length === 0) {
    return {
      kind: 'unknown',
      attempts: 0,
      ratio: 0,
      message: '세트를 마치고 완주 개수를 남기면 목표가 적절한지 판정합니다.',
    }
  }

  const ratio =
    recent.reduce(
      (sum, log) => sum + (log.plannedReps > 0 ? log.completedReps / log.plannedReps : 0),
      0,
    ) / recent.length

  const average = Math.round(ratio * 100)

  if (recent.length < WINDOW) {
    return {
      kind: 'unknown',
      attempts: recent.length,
      ratio,
      message: `${recent.length}회 기록됨 (평균 완주 ${average}%). ${WINDOW}회가 모이면 목표를 판정합니다.`,
    }
  }

  if (ratio < TOO_HARD_RATIO) {
    return {
      kind: 'too-hard',
      attempts: recent.length,
      ratio,
      message: `최근 ${WINDOW}회 평균 완주 ${average}%. 아직 이른 목표입니다 — 중간목표를 세우고 단계적으로 당기세요.`,
    }
  }

  if (ratio >= READY_RATIO) {
    return {
      kind: 'ready',
      attempts: recent.length,
      ratio,
      message: `최근 ${WINDOW}회 평균 완주 ${average}%. 목표 페이스를 지켜내고 있습니다 — 목표기록을 당길 때입니다.`,
    }
  }

  return {
    kind: 'on-track',
    attempts: recent.length,
    ratio,
    message: `최근 ${WINDOW}회 평균 완주 ${average}%. 목표 페이스가 지금 수준에 맞습니다.`,
  }
}

/**
 * 판정을 목표기록 조정폭으로 옮긴다.
 *
 * 완주율이 낮으면 목표를 늦추고, 계속 다 채우면 당긴다. 폭은 완주율에서
 * 선형으로 뽑되 한 번에 2% 를 넘기지 않는다 — 목표가 매주 흔들리면 앵커가 아니다.
 */
export function suggestedTargetCs(currentTargetCs: number, result: Verdict): number | null {
  if (result.kind === 'too-hard') {
    const shortfall = Math.min(TOO_HARD_RATIO - result.ratio, 0.3)
    return Math.round(currentTargetCs * (1 + Math.min(shortfall * 0.06, 0.02)))
  }

  if (result.kind === 'ready') {
    return Math.round(currentTargetCs * 0.99)
  }

  return null
}
