/**
 * 기록 단축 세트 (기능1). "1초 줄이려면 뭘 해야 하나?"에 답한다.
 *
 * 목표까지의 차이를 **1초씩 끊어** 단계마다 세트 묶음을 낸다. 단계마다 목표기록이
 * 1초씩 당겨지므로 같은 세트라도 25m 목표 페이스와 인터벌이 단계마다 다르다.
 *
 * 묶음은 두 군데서 온다(PRD-0001 §4.1).
 * 1. **공식 기본값** — v1 의 `methods.ts` 카탈로그에서 단축 구간별로 방법을 골라 둔 표.
 *    반복 수 · 휴식은 v1 이 기록 등급별로 정해 둔 값을 그대로 쓴다.
 * 2. **코치 처방** — 운영자가 종목 · 단축 구간별로 덮어쓴 묶음. 있으면 이것이 우선한다.
 * 화면은 둘 중 어느 것인지 항상 밝힌다.
 *
 * 공식 표(FORMULA)는 **잠정값**이다. "1초 = 세트 몇 개"는 코치와 정할 열린 질문이고
 * (PRD-0001 §11-1), 그 전까지는 아래 원칙으로 골랐다.
 * - 첫 1초: 체력보다 기술로 줄어드는 벽 구간(50m 는 스타트, 100m 는 턴 셋) + 레이스 페이스.
 * - 두 번째 1초: 페이스를 턴 너머로 잇기(100m 는 50m 반복) + 잠영.
 * - 2초 넘게: 천장 올리기 — 목표보다 빠른 페이스와 젖산 내성.
 */
import { DIVE_ADVANTAGE_CS, improvementPercent, racePace25 } from '../../../src/pace'
import { recordLevel } from '../../../src/grading'
import { methodById, type PoolSpec } from '../../../src/methods'
import type { Level } from '../../../src/types'
import { formatTime } from './time'
import type { Sex, SwimEvent } from './types'

/** 단축 구간: 1 = 0~1초, 2 = 1~2초, 3 = 2초 넘게. 코치가 이 단위로 덮어쓴다. */
export type Bracket = 1 | 2 | 3

export const BRACKETS: readonly Bracket[] = [1, 2, 3]

export const BRACKET_LABEL: Record<Bracket, string> = {
  1: '첫 1초 (0~1초)',
  2: '두 번째 1초 (1~2초)',
  3: '2초 넘게',
}

export type SetEffort = 'pace' | 'max' | 'easy' | 'technique'

export const EFFORT_LABEL: Record<SetEffort, string> = {
  pace: '목표 페이스',
  max: '전력',
  easy: '편하게',
  technique: '기술 위주',
}

export interface SetLine {
  name: string
  reps: number
  /** 반복 거리(m). */
  distance: number
  /** 반복 사이 휴식(초). null 이면 완전 회복 — 시계로 재지 않는다. */
  restS: number | null
  effort: SetEffort
  /** `pace` 일 때 25m 당 보정(cs). 음수면 목표보다 빠르게. */
  paceOffsetCs: number
  note: string
}

export interface SetPlan {
  lines: SetLine[]
  perWeek: number
  weeks: number
}

/** 코치가 덮어쓴 묶음. 종목 · 구간마다 하나. */
export interface SetOverride extends SwimEvent {
  bracket: Bracket
  plan: SetPlan
  updatedAt: string
}

/** 화면에 한 번에 보이는 단계 수. 5초 넘는 목표는 먼저 5초를 줄이고 다시 잡는다. */
export const MAX_STEPS = 5

const SECOND = 100

/** 종목 거리별 · 구간별 공식 기본 방법(v1 `methods.ts` 의 id). */
const FORMULA: Record<50 | 100, Record<Bracket, string[]>> = {
  50: { 1: ['rp25', 'starts'], 2: ['rp25', 'underwater'], 3: ['rp25', 'sprint-power', 'lactate-tolerance'] },
  100: { 1: ['rp25', 'turns'], 2: ['rp50', 'underwater'], 3: ['broken', 'lactate-tolerance'] },
}

/** 구간별 기간. 뒤로 갈수록 몸이 바뀌어야 하는 일이라 길다. */
const FORMULA_WEEKS: Record<Bracket, number> = { 1: 4, 2: 6, 3: 8 }
const FORMULA_PER_WEEK = 2

export function bracketOf(step: number): Bracket {
  return step <= 1 ? 1 : step === 2 ? 2 : 3
}

/**
 * 공식 기본 묶음. 반복 수는 지금 기록의 등급에서 온다.
 *
 * 성별은 운영자가 넣는 선택값이다. 비어 있으면 남자 기준으로 매긴다 — 여자 회원은
 * 한 단계 낮게 잡혀 반복이 적고 휴식이 길어진다. 넘치는 쪽보다 모자라는 쪽으로 틀리게 둔 것이다.
 */
export function formulaPlan(event: SwimEvent, bracket: Bracket, currentCs: number, sex: Sex | null = null): SetPlan {
  return formulaPlanAt(event, bracket, recordLevel(currentCs, event, sex ?? 'M'))
}

/** 등급을 직접 주는 판. 코치 화면이 "중급 회원이면 이렇다"를 밑그림으로 쓴다. */
export function formulaPlanAt(event: SwimEvent, bracket: Bracket, level: Level): SetPlan {
  const ids = FORMULA[event.distance === 50 ? 50 : 100][bracket]
  const lines: SetLine[] = []
  for (const id of ids) {
    const method = methodById(id)
    if (method?.kind !== 'pool') continue
    const spec = method.levels[level]
    if (spec) lines.push(fromSpec(method.name, spec, event.distance))
  }
  return { lines, perWeek: FORMULA_PER_WEEK, weeks: FORMULA_WEEKS[bracket] }
}

function fromSpec(name: string, spec: PoolSpec, eventDistance: number): SetLine {
  return {
    name,
    reps: spec.reps,
    // v1 의 0 은 "목표 종목 거리 그대로". 브로큰처럼 100m 고정인 세트는 50m 종목에서 50m 로 줄인다.
    distance: spec.distance === 0 ? eventDistance : Math.min(spec.distance, Math.max(eventDistance, 25)),
    restS: spec.restCs === null ? null : spec.restCs / SECOND,
    effort: spec.effort ?? 'pace',
    paceOffsetCs: spec.paceOffsetCs,
    note: spec.note ?? '',
  }
}

// ── 처방 ────────────────────────────────────────────────────

export interface LineView {
  line: SetLine
  /** `16 × 25m` */
  head: string
  /** 반복 하나의 목표 시간. 페이스 세트가 아니면 null. */
  targetCs: number | null
  /** 출발 간격(cs). 5초 단위로 올린다 — 벽시계로 출발을 맞춘다. 페이스 세트가 아니거나 완전 회복이면 null. */
  intervalCs: number | null
}

export interface Step {
  /** 1부터. */
  index: number
  bracket: Bracket
  fromCs: number
  toCs: number
  /** 이 단계 목표기록의 훈련용 25m 목표 페이스(다이빙 이득 보정). */
  pace25Cs: number
  plan: SetPlan
  source: 'formula' | 'coach'
  lines: LineView[]
}

export interface Prescription {
  event: SwimEvent
  currentCs: number
  targetCs: number
  gapCs: number
  /** 1.0 이 1% 단축. */
  percent: number
  steps: Step[]
  /** 목표가 MAX_STEPS 초보다 멀어 앞 단계만 보이는 중. */
  truncated: boolean
  /** 훈련 25m 목표가 대회 평균 25m 보다 느린 폭(cs). 다이빙 이득을 거리로 나눈 값. */
  diveShareCs: number
}

export function prescribe(
  event: SwimEvent,
  currentCs: number,
  targetCs: number,
  overrides: readonly SetOverride[],
  sex: Sex | null = null,
): Prescription | null {
  const gapCs = currentCs - targetCs
  if (gapCs <= 0) return null

  const total = Math.ceil(gapCs / SECOND)
  const count = Math.min(total, MAX_STEPS)
  const steps: Step[] = []
  for (let index = 1; index <= count; index++) {
    const bracket = bracketOf(index)
    const fromCs = currentCs - (index - 1) * SECOND
    const toCs = Math.max(targetCs, currentCs - index * SECOND)
    const pace25Cs = racePace25(toCs, event.distance)
    const override = overrides.find(
      (o) => o.stroke === event.stroke && o.distance === event.distance && o.bracket === bracket,
    )
    const plan = override?.plan ?? formulaPlan(event, bracket, currentCs, sex)
    steps.push({
      index,
      bracket,
      fromCs,
      toCs,
      pace25Cs,
      plan,
      source: override ? 'coach' : 'formula',
      lines: plan.lines.map((line) => viewLine(line, pace25Cs)),
    })
  }

  return {
    event,
    currentCs,
    targetCs,
    gapCs,
    percent: improvementPercent(currentCs, targetCs),
    steps,
    truncated: total > MAX_STEPS,
    diveShareCs: DIVE_ADVANTAGE_CS / (event.distance / 25),
  }
}

export function viewLine(line: SetLine, pace25Cs: number): LineView {
  const head = `${line.reps} × ${line.distance}m`
  if (line.effort !== 'pace') return { line, head, targetCs: null, intervalCs: null }
  const targetCs = Math.round((pace25Cs + line.paceOffsetCs) * (line.distance / 25))
  const intervalCs = line.restS === null ? null : roundUpTo5s(targetCs + line.restS * SECOND)
  return { line, head, targetCs, intervalCs }
}

const roundUpTo5s = (cs: number): number => Math.ceil(cs / 500) * 500

/** `35초` · `1분 05초` — 출발 간격은 초 단위로 읽는다. */
export function clockLabel(cs: number): string {
  const seconds = Math.round(cs / SECOND)
  if (seconds < 60) return `${seconds}초`
  const rest = seconds % 60
  return `${Math.floor(seconds / 60)}분${rest ? ` ${String(rest).padStart(2, '0')}초` : ''}`
}

/** 줄 하나를 한 문장으로. 코치 화면 미리보기와 테스트에 쓴다. */
export function describeLine(view: LineView): string {
  const { line } = view
  const parts = [`${line.name} · ${view.head}`]
  if (view.targetCs !== null) {
    parts.push(`@ ${formatTime(view.targetCs)}`)
    parts.push(view.intervalCs === null ? '완전 회복' : `인터벌 ${clockLabel(view.intervalCs)}`)
  } else {
    parts.push(EFFORT_LABEL[line.effort])
    parts.push(line.restS === null ? '완전 회복' : `휴식 ${line.restS}초`)
  }
  return parts.join(' · ')
}

// ── 코치 입력 검사 ───────────────────────────────────────────

export const PLAN_LINES_MAX = 4
export const SET_DISTANCES = [15, 25, 50, 75, 100, 200] as const

export function planProblem(plan: SetPlan): string | null {
  if (plan.lines.length === 0) return '세트를 한 줄 이상 넣어 주세요.'
  if (plan.lines.length > PLAN_LINES_MAX) return `세트는 ${PLAN_LINES_MAX}줄까지입니다.`
  for (const [i, line] of plan.lines.entries()) {
    const at = `${i + 1}째 줄`
    if (!line.name.trim() || line.name.length > 30) return `${at}: 세트 이름을 30자 안으로 넣어 주세요.`
    if (!Number.isInteger(line.reps) || line.reps < 1 || line.reps > 40) return `${at}: 반복은 1~40회입니다.`
    if (!(SET_DISTANCES as readonly number[]).includes(line.distance)) return `${at}: 거리를 골라 주세요.`
    if (line.restS !== null && (!Number.isInteger(line.restS) || line.restS < 0 || line.restS > 300)) {
      return `${at}: 휴식은 0~300초입니다. 완전 회복이면 비워 두세요.`
    }
    if (line.note.length > 60) return `${at}: 메모는 60자까지입니다.`
  }
  if (!Number.isInteger(plan.perWeek) || plan.perWeek < 1 || plan.perWeek > 7) return '주당 횟수는 1~7회입니다.'
  if (!Number.isInteger(plan.weeks) || plan.weeks < 1 || plan.weeks > 16) return '기간은 1~16주입니다.'
  return null
}

/** DB 의 JSON 을 믿지 않는다. 모양이 어긋나면 null — 그 구간은 공식 기본값으로 돌아간다. */
export function parsePlan(value: unknown): SetPlan | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.lines)) return null
  const lines: SetLine[] = []
  for (const item of raw.lines) {
    if (typeof item !== 'object' || item === null) return null
    const l = item as Record<string, unknown>
    const effort = typeof l.effort === 'string' && Object.hasOwn(EFFORT_LABEL, l.effort) ? (l.effort as SetEffort) : null
    if (
      typeof l.name !== 'string' ||
      typeof l.reps !== 'number' ||
      typeof l.distance !== 'number' ||
      !(l.restS === null || typeof l.restS === 'number') ||
      effort === null
    ) {
      return null
    }
    lines.push({
      name: l.name,
      reps: l.reps,
      distance: l.distance,
      restS: l.restS as number | null,
      effort,
      paceOffsetCs: typeof l.paceOffsetCs === 'number' ? l.paceOffsetCs : 0,
      note: typeof l.note === 'string' ? l.note : '',
    })
  }
  const plan = { lines, perWeek: Number(raw.perWeek), weeks: Number(raw.weeks) }
  return planProblem(plan) === null ? plan : null
}
