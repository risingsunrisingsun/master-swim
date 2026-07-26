/**
 * 주간 플랜 배치.
 *
 * 주역(레이스 페이스)은 고정하고 남은 자리를 목표 종목에 따라 채운다. 1차에는 진단이
 * 없으므로 목표 거리가 그 판단을 대신한다 — 25m 종목은 벽 구간이 기록의 큰 몫을 먹고,
 * 100m 는 턴 세 개와 지속력이 먼저다. 3차에 병목 진단이 들어오면 이 자리에 연결된다.
 *
 * 결석해도 무너지지 않도록 다주 주기화를 하지 않는다. 매주 같은 골격을 새로 받는다.
 */
import type { Grading } from './grading'
import {
  describeDrylandSet,
  describePoolSet,
  methodById,
  type DrylandSpec,
  type PoolSpec,
  type TrainingMethod,
} from './methods'
import { racePace25 } from './pace'
import type { Distance, Level, Profile } from './types'

export type SessionFocus = 'racePace' | 'speed' | 'wall' | 'technique' | 'endurance'

export const FOCUS_TITLE: Record<SessionFocus, string> = {
  racePace: '레이스 페이스',
  speed: '최대 속도',
  wall: '벽 구간',
  technique: '기술',
  endurance: '지속력 · 회복',
}

/**
 * 목표 거리별 세션 우선순위. 주간 횟수만큼 앞에서부터 잘라 쓴다.
 *
 * 25m 는 스타트와 잠영이 기록의 3~4할이라 벽 구간이 최대 속도보다 앞선다.
 * 100m 는 턴이 세 개라 벽 구간이 앞서고, 후반 유지 때문에 지속력이 최대 속도를 밀어낸다.
 */
const FOCUS_PRIORITY: Record<Distance, readonly SessionFocus[]> = {
  25: ['racePace', 'wall', 'speed', 'technique', 'endurance'],
  50: ['racePace', 'speed', 'wall', 'technique', 'endurance'],
  100: ['racePace', 'wall', 'endurance', 'technique', 'speed'],
}

/** 세션을 이루는 수영장 방법. 목표 거리와 강도 등급에 따라 갈린다. */
function poolIdsFor(focus: SessionFocus, distance: Distance, intensity: Level): string[] {
  const isLong = distance === 100

  switch (focus) {
    case 'racePace':
      return isLong ? ['rp50', 'negative'] : ['rp25', 'descending']
    case 'speed':
      // 젖산 내성은 초급 강도에서 null 이라 자동으로 킥으로 대체된다.
      return intensity === 'beginner' || intensity === 'intermediate'
        ? ['sprint-power', 'kick']
        : ['sprint-power', 'lactate-tolerance']
    case 'wall':
      return isLong ? ['turns', 'underwater'] : ['underwater', 'starts']
    case 'technique':
      return ['drills', 'dps']
    case 'endurance':
      return ['aerobic', 'recovery']
  }
}

/**
 * 세션 뒤에 붙는 육상. 별도 요일로 빼면 실행되지 않으므로 수영에 붙인다.
 * 하체 파워는 다리가 지치면 킥과 턴이 무너지므로 반드시 세션 **후**다.
 */
const DRYLAND_AFTER: Record<SessionFocus, string> = {
  racePace: 'core-antirotation',
  speed: 'lower-power',
  wall: 'lower-power',
  technique: 'rotator-cuff',
  endurance: 'rotator-cuff',
}

export type ItemRole = 'main' | 'support' | 'warmup' | 'after'

export interface PlannedItem {
  role: ItemRole
  method: TrainingMethod
  /** 화면에 그대로 쓰는 지시문. */
  text: string
  note?: string
}

export interface PlannedSession {
  focus: SessionFocus
  title: string
  items: PlannedItem[]
  /** 수영 구간 합계(m). 육상은 제외한다. */
  meters: number
}

/**
 * 두 축을 합쳐 실제 세트를 만든다.
 *
 * **반복 수는 분량 등급**(주간 횟수·거리)에서, **인터벌과 반복 거리는 강도 등급**(기록)에서
 * 가져온다. 이것이 "기록이 강도를, 훈련량이 분량을 정한다"는 규칙의 구현이다.
 * 어느 축에서든 처방하지 않는 방법이면 null 을 돌려 세션에서 빠진다.
 */
function mergedPoolSpec(method: TrainingMethod, intensity: Level, volume: Level): PoolSpec | null {
  if (method.kind !== 'pool') return null

  const byIntensity = method.levels[intensity]
  const byVolume = method.levels[volume]
  if (!byIntensity || !byVolume) return null

  return { ...byIntensity, reps: byVolume.reps }
}

function drylandSpecFor(method: TrainingMethod, volume: Level): DrylandSpec | null {
  return method.kind === 'dryland' ? method.levels[volume] : null
}

function buildSession(
  focus: SessionFocus,
  profile: Profile,
  grading: Grading,
  pace25Cs: number,
): PlannedSession {
  const { distance } = profile.goal.event
  const items: PlannedItem[] = []
  let meters = 0

  const mobility = methodById('mobility')
  const mobilitySpec = mobility ? drylandSpecFor(mobility, grading.volume) : null
  if (mobility && mobilitySpec) {
    items.push({
      role: 'warmup',
      method: mobility,
      text: describeDrylandSet(mobilitySpec),
      note: mobilitySpec.note,
    })
  }

  const poolIds = poolIdsFor(focus, distance, grading.intensity)
  poolIds.forEach((id, index) => {
    const method = methodById(id)
    if (!method) return

    const spec = mergedPoolSpec(method, grading.intensity, grading.volume)
    if (!spec) return

    const repDistance = spec.distance === 0 ? distance : spec.distance
    meters += spec.reps * repDistance

    items.push({
      role: index === 0 ? 'main' : 'support',
      method,
      text: describePoolSet(spec, pace25Cs, distance),
      note: spec.note,
    })
  })

  const after = methodById(DRYLAND_AFTER[focus])
  const afterSpec = after ? drylandSpecFor(after, grading.volume) : null
  if (after && afterSpec) {
    items.push({
      role: 'after',
      method: after,
      text: describeDrylandSet(afterSpec),
      note: afterSpec.note,
    })
  }

  return { focus, title: FOCUS_TITLE[focus], items, meters }
}

/**
 * 한 주 계획. 주간 횟수가 우선순위 목록보다 많으면 앞에서부터 다시 돌아
 * 레이스 페이스 세션이 한 주에 두 번 들어간다 — 가장 중요한 것을 반복한다.
 */
export function weeklyPlan(profile: Profile, grading: Grading): PlannedSession[] {
  const { event, targetCs } = profile.goal
  const pace25Cs = racePace25(targetCs, event.distance)
  const priority = FOCUS_PRIORITY[event.distance]

  const sessions = Math.max(1, Math.min(7, Math.round(profile.load.sessionsPerWeek)))

  return Array.from({ length: sessions }, (_, index) =>
    buildSession(priority[index % priority.length]!, profile, grading, pace25Cs),
  )
}

/** 계획 전체의 수영 거리 합계. 입력한 세션당 거리와 비교해 현실성을 가늠하는 데 쓴다. */
export function weeklyMeters(plan: readonly PlannedSession[]): number {
  return plan.reduce((total, session) => total + session.meters, 0)
}

/** 세션 성격별 수영 MET. 식단의 소모 열량 계산에 쓴다. */
export const SESSION_MET: Record<SessionFocus, number> = {
  racePace: 8.3,
  speed: 8.3,
  wall: 7.0,
  technique: 6.0,
  endurance: 7.0,
}

export const WEEKDAY_LABEL = ['월', '화', '수', '목', '금', '토', '일'] as const

export interface WeekDay {
  /** 0 = 월요일 */
  index: number
  label: string
  /** 훈련이 없는 날은 null — 식단은 휴식일 기준으로 나간다. */
  session: PlannedSession | null
}

/**
 * 세션을 한 주 7일에 고르게 흩는다.
 *
 * 주 3회를 월·화·수로 몰면 회복이 안 되고 나머지 나흘이 비므로,
 * `round(i × 7 / n)` 으로 간격을 벌린다 — 3회면 월·수·금이 된다.
 */
export function weekDays(plan: readonly PlannedSession[]): WeekDay[] {
  const slots = new Map<number, PlannedSession>()

  plan.forEach((session, i) => {
    let day = Math.round((i * 7) / plan.length)
    while (slots.has(day) && day < 7) day++
    if (day < 7) slots.set(day, session)
  })

  return WEEKDAY_LABEL.map((label, index) => ({
    index,
    label,
    session: slots.get(index) ?? null,
  }))
}
