/**
 * 기록 시간 — 1/100초 정수(cs) 하나로 다룬다.
 *
 * 표기와 두 칸 입력은 v1 `pace.ts` 를 그대로 쓴다(PRD-0001 §8 엔진 재사용). 분 칸과 초 칸을
 * 나누고, 초 칸은 소수점을 받는다 — v1 이 한 칸 숫자 입력(`11200`)을 걷어낸 이유와 같다.
 * 1/100초를 세 번째 칸으로 떼지 않은 것은 운영자가 30명을 2분 안에 넣어야 해서다
 * (칸이 90개가 된다). `32.4` 는 32.40 으로 읽고, 화면이 읽은 값을 바로 옆에 보여준다.
 */
import { composeTimeInput, formatTime, refoldTimeInput, splitTimeInput } from '../../../src/pace'
import { type Distance, RECORD_EVENTS, STROKE_LABEL, type Stroke, type SwimEvent } from './types'

export { formatTime }

/** 50m 이하는 분 칸을 숨긴다. 1분 넘는 50m 는 초 칸에 `65.30` 으로 넣는다. */
export const hasMinuteField = (distance: Distance): boolean => distance > 50

/** 분 칸 · 초 칸 → cs. 읽을 수 없으면 null. */
export function readTime(minutes: string, seconds: string): number | null {
  return composeTimeInput(minutes, seconds)
}

/** cs → 두 칸에 되돌려 넣을 값. */
export function timeFields(cs: number, distance: Distance): { minutes: string; seconds: string } {
  return splitTimeInput(cs, !hasMinuteField(distance))
}

/** 분 칸이 숨거나 생길 때 같은 기록을 가리키게 두 칸을 다시 접는다(v1 과 같은 규칙). */
export function refoldTime(minutes: string, seconds: string, secondsOnly: boolean): { minutes: string; seconds: string } {
  return refoldTimeInput(minutes, seconds, secondsOnly)
}

/**
 * 25m 당 9초보다 빠르면 세계기록보다 빠르다 — 칸을 잘못 넣은 것이다.
 * 위로는 25m 당 2분까지 받는다. 처음 온 회원의 평영도 들어가야 한다.
 */
export function timeProblem(cs: number | null, distance: Distance): string | null {
  if (cs === null) return '기록을 읽을 수 없습니다. 초 칸은 32.40 처럼 쓰고, 분 칸이 있으면 60 미만으로 씁니다.'
  const lengths = distance / 25
  if (cs < 900 * lengths) return `${formatTime(cs)} 는 너무 빠릅니다. 분 · 초 칸을 확인해 주세요.`
  if (cs > 12000 * lengths) return `${formatTime(cs)} 는 너무 깁니다. 분 · 초 칸을 확인해 주세요.`
  return null
}

// ── 종목 키 ─────────────────────────────────────────────────
// 주소(`#/records?e=free-50`)와 select 값에 쓰는 한 덩어리 이름.

export const eventKey = (event: SwimEvent): string => `${event.stroke}-${event.distance}`

export function parseEventKey(key: string | null | undefined): SwimEvent | null {
  return RECORD_EVENTS.find((event) => eventKey(event) === key) ?? null
}

export const eventLabel = (event: SwimEvent): string => `${STROKE_LABEL[event.stroke]} ${event.distance}m`

export const sameEvent = (a: SwimEvent, b: SwimEvent): boolean =>
  a.stroke === b.stroke && a.distance === b.distance

/** 세트 처방을 받는 종목 — 네 영법 50 · 100m. */
export const SET_EVENTS: readonly SwimEvent[] = RECORD_EVENTS.filter(
  (event) => event.stroke !== 'im' && event.distance !== 25,
)

export const isStroke = (value: string): value is Stroke => Object.hasOwn(STROKE_LABEL, value)
