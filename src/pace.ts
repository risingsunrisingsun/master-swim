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
