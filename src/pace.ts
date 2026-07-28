/**
 * 목표 페이스 엔진.
 *
 * 이 앱의 모든 세트는 여기서 나오는 한 숫자 — 25m당 목표 페이스 — 에 매달려 있다.
 * 순수 함수만 두고 DOM·저장소·네트워크를 참조하지 않는다. (ADR-0001)
 */
import type { Distance } from './types'

/** 지원 수영장은 25m 단수로 하나뿐이다. (CONTEXT.md · 범위) */
export const POOL_LENGTH_M = 25

/**
 * 다이빙 스타트가 벽 푸시오프 대비 갖는 이득 (centisecond).
 *
 * 대회 첫 구간은 다이빙으로 출발하지만 훈련 반복은 벽에서 푸시오프로 출발한다.
 * 이 차이를 보정하지 않으면 훈련 목표 페이스가 실제보다 빠르게 잡혀
 * 지킬 수 없는 세트가 나온다.
 */
export const DIVE_ADVANTAGE_CS = 70

/** "1:23.45" · "23.45" · "1:23" 을 centisecond 로. 형식이 어긋나면 null. */
export function parseTime(input: string): number | null {
  const text = input.trim()
  if (text === '') return null

  const match = /^(?:(\d{1,2}):)?(\d{1,2})(?:[.,](\d{1,2}))?$/.exec(text)
  if (!match) return null

  const [, minutes, seconds, fraction] = match
  const sec = Number(seconds)
  if (sec > 59) return null

  const centis = fraction ? Number(fraction.padEnd(2, '0')) : 0
  return (Number(minutes ?? 0) * 60 + sec) * 100 + centis
}

/**
 * 폰에서 들어오는 입력을 받는다.
 *
 * 숫자 키패드에는 콜론이 없어서 `1:23.45` 를 칠 수가 없다. 그래서 스톱워치·기록 앱이
 * 쓰는 방식대로 **숫자만 받아 오른쪽부터 채운다** — 뒤 두 자리가 1/100초, 그 앞 두
 * 자리가 초, 나머지가 분이다.
 *
 *   12345 → 1:23.45      2345 → 23.45      130 → 1.30
 *
 * 구분자를 칠 수 있는 환경(데스크톱)에서는 `1:23.45` 도 그대로 받는다.
 */
export function parseTimeInput(input: string): number | null {
  const text = input.trim()
  if (text === '') return null

  // 콜론이 있으면 사용자가 형식을 갖춰 쳤다는 뜻이다. 기존 규칙으로 보낸다.
  if (text.includes(':')) return parseTime(text)

  const digits = text.replace(/\D/g, '')
  if (digits === '' || digits.length > 6) return null

  const padded = digits.padStart(3, '0')
  const centis = Number(padded.slice(-2))
  const seconds = Number(padded.slice(-4, -2))
  const minutes = Number(padded.slice(0, -4) || '0')

  if (seconds > 59) return null
  return (minutes * 60 + seconds) * 100 + centis
}

/**
 * 분 칸과 초 칸을 따로 받는다.
 *
 * 훈련 화면은 목표 거리가 정해져 있으므로 자리수를 미리 안다. 100m 는 분이 필요하고
 * 50m 는 초만 있으면 된다. 한 칸에 몰아넣고 오른쪽부터 채우는 방식(`parseTimeInput`)
 * 보다 칸을 나누는 편이 폰에서 오해가 없다.
 *
 * 초 칸은 소수점을 그대로 받는다 — 십진 키패드에는 마침표가 있다.
 * 분 칸이 비었으면 0분으로 본다. **분이 0이면 초가 60 이상이어도 받는다** —
 * 50m 를 1분 넘겨 도는 회원이 초 칸에 `65.30` 을 치는 것이 자연스럽다.
 */
export function composeTimeInput(minutes: string, seconds: string): number | null {
  if (seconds.trim() === '') return null

  const min = minutes.trim() === '' ? 0 : Number(minutes)
  const sec = Number(seconds)
  if (!Number.isFinite(min) || !Number.isFinite(sec)) return null
  if (min < 0 || sec < 0) return null
  if (min > 0 && sec >= 60) return null

  const total = Math.round(min * 6000 + sec * 100)
  return total > 0 ? total : null
}

/**
 * centisecond 를 분·초 두 칸에 되돌려 넣을 값으로 쪼갠다. `composeTimeInput` 의 역.
 *
 * `secondsOnly` 면 분을 초에 접어 넣는다 — 50m 화면에는 분 칸이 없으므로
 * 1:05.30 을 `65.30` 으로 내려야 값이 보존된다.
 */
export function splitTimeInput(
  cs: number,
  secondsOnly = false,
): { minutes: string; seconds: string } {
  const rounded = Math.round(cs)
  if (secondsOnly) return { minutes: '', seconds: (rounded / 100).toFixed(2) }

  const minutes = Math.floor(rounded / 6000)
  const rest = rounded - minutes * 6000
  return {
    minutes: minutes > 0 ? String(minutes) : '',
    seconds: (rest / 100).toFixed(2),
  }
}

/** centisecond 를 "1:23.45" 로. 1분 미만이면 "23.45". */
export function formatTime(cs: number): string {
  const rounded = Math.round(cs)
  const totalSeconds = Math.floor(rounded / 100)
  const centis = rounded % 100
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  const tail = `${String(seconds).padStart(minutes > 0 ? 2 : 1, '0')}.${String(centis).padStart(2, '0')}`
  return minutes > 0 ? `${minutes}:${tail}` : tail
}

export function lengthsFor(distance: Distance): number {
  return distance / POOL_LENGTH_M
}

/**
 * 목표기록에서 훈련용 25m 목표 페이스를 뽑는다.
 *
 *   목표기록 = (첫 구간: p − 다이빙이득) + (나머지 구간: p × (n−1))
 *            = p × n − 다이빙이득
 *   ⇒ p = (목표기록 + 다이빙이득) / n
 *
 * 100m 목표 1:20.00 이면 p = 20.18 — 훈련에서 푸시오프로 출발해 지켜야 할 페이스다.
 */
export function racePace25(targetCs: number, distance: Distance): number {
  return (targetCs + DIVE_ADVANTAGE_CS) / lengthsFor(distance)
}

/** 대회에서 나와야 할 구간별 누적 기록. 첫 구간만 다이빙 이득을 받는다. */
export function splitTargets(targetCs: number, distance: Distance): number[] {
  const pace = racePace25(targetCs, distance)
  const lengths = lengthsFor(distance)

  const splits: number[] = []
  let elapsed = 0
  for (let i = 0; i < lengths; i++) {
    elapsed += i === 0 ? pace - DIVE_ADVANTAGE_CS : pace
    splits.push(elapsed)
  }
  return splits
}

/** 현재기록 대비 목표기록의 단축 폭. 1.0 이 1% 단축. */
export function improvementPercent(currentCs: number, targetCs: number): number {
  if (currentCs <= 0) return 0
  return ((currentCs - targetCs) / currentCs) * 100
}
