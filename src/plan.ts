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
import type { Distance, Level, Profile, Purpose, SessionFormat } from './types'

export type SessionFocus = 'racePace' | 'speed' | 'wall' | 'technique' | 'breathing' | 'endurance'

export const FOCUS_TITLE: Record<SessionFocus, string> = {
  racePace: '레이스 페이스',
  speed: '최대 속도',
  wall: '벽 구간',
  technique: '기술',
  breathing: '호흡',
  endurance: '지속력 · 회복',
}

/**
 * 목적 · 목표 거리별 세션 우선순위. 주간 횟수만큼 앞에서부터 잘라 쓴다.
 *
 * `faster` 는 이 앱의 기본값이고 **거리별 값이 예전 그대로다** — 목적을 고르지 않던
 * 때와 같은 플랜이 나온다.
 *
 * 25m 는 스타트와 잠영이 기록의 3~4할이라 벽 구간이 최대 속도보다 앞선다.
 * 100m 는 턴이 세 개라 벽 구간이 앞서고, 후반 유지 때문에 지속력이 최대 속도를 밀어낸다.
 */
const FOCUS_PRIORITY: Record<Purpose, Record<Distance, readonly SessionFocus[]>> = {
  faster: {
    25: ['racePace', 'wall', 'speed', 'technique', 'endurance', 'breathing'],
    50: ['racePace', 'speed', 'wall', 'technique', 'endurance', 'breathing'],
    100: ['racePace', 'wall', 'endurance', 'technique', 'speed', 'breathing'],
  },
  // 기술이 주역이고 레이스 페이스가 바로 뒤를 받친다 — 고친 자세가 속도에서도
  // 남는지 확인하지 않으면 드릴을 위한 드릴이 된다.
  form: {
    25: ['technique', 'racePace', 'wall', 'speed', 'endurance', 'breathing'],
    50: ['technique', 'racePace', 'wall', 'speed', 'endurance', 'breathing'],
    100: ['technique', 'racePace', 'wall', 'endurance', 'speed', 'breathing'],
  },
  // 최대 속도를 **뒤로 밀되 빼지는 않는다.** 호흡을 고쳐도 전 종목이 스프린트라는
  // 사실은 달라지지 않는다 — 한 주기 내내 전력이 없으면 목표 페이스의 천장이 그대로다.
  breathing: {
    25: ['breathing', 'technique', 'racePace', 'wall', 'speed', 'endurance'],
    50: ['breathing', 'technique', 'racePace', 'endurance', 'speed', 'wall'],
    100: ['breathing', 'technique', 'racePace', 'endurance', 'speed', 'wall'],
  },
  // 강도를 앞에 두지 않는다. 최대 속도는 맨 뒤로 밀어 주 2~3회 나오는 회원에게는
  // 아예 배정되지 않게 한다.
  injury: {
    25: ['technique', 'endurance', 'racePace', 'wall', 'speed', 'breathing'],
    50: ['technique', 'endurance', 'racePace', 'wall', 'speed', 'breathing'],
    100: ['technique', 'endurance', 'racePace', 'wall', 'speed', 'breathing'],
  },
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
    case 'breathing':
      // 100m 는 후반에 숨이 무너지므로 배분이 주역이고, 50m 는 배분할 구간이
      // 짧아 좌우 균형을 먼저 잡는다.
      return isLong ? ['breath-plan', 'bilateral'] : ['bilateral', 'breath-timing']
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
  // 호흡할 때 몸이 흔들리는 것은 몸통이 못 버텨서인 경우가 많다.
  breathing: 'core-antirotation',
  endurance: 'rotator-cuff',
}

/**
 * 세션 뒤에 붙일 육상을 고른다.
 *
 * 형식 선택이 바꾸는 것은 **어떤 것이 붙느냐**뿐이다. 붙는 자리(수영 뒤)는 바꾸지
 * 않는다 — 그것은 취향이 아니라 훈련 순서다.
 *
 * 밴드를 고르면 회전근개 세트가 온다. 그 세트가 밴드 외회전·밴드 로우로 되어 있어
 * 도구가 실제로 밴드다(`dryland.ts`). 나머지는 성격에 맞는 기본값 그대로다.
 */
function drylandAfterFor(focus: SessionFocus, format: SessionFormat): string {
  return format === 'band' ? 'rotator-cuff' : DRYLAND_AFTER[focus]
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

/** 이지 스윔은 50m 단위로 끊는다. 25m 단수로에서 왕복 한 번이 최소 단위다. */
const FILLER_STEP = 50

/**
 * 채우기의 상한. 이보다 더 모자라면 남겨 둔다.
 *
 * 회원이 적은 값이 실제보다 크게 적혀 있을 수 있고(주간 거리와 헷갈려 적는 일이 흔하다),
 * 그때 이지 스윔 3,000m 를 처방하면 그날 훈련이 통째로 채우기가 된다. 화면의
 * `계획 / 내가 적은 양` 이 남은 차이를 계속 보여주므로 회원이 스스로 판단할 수 있다.
 */
const FILLER_MAX_METERS = 2_000

/**
 * 선언한 세션 거리에 못 미치는 만큼을 **쉬운 헤엄**으로 채운다.
 *
 * 성격마다 질 위주 세트의 거리가 벽 구간 240m ~ 지속력 1,700m 로 7배 벌어진다. 그대로
 * 두면 목적이 순서를 바꿀 때 무엇이 잘리느냐로 주간 총량이 배 넘게 흔들리고, 그날 식단
 * 열량까지 함께 움직인다. 실제 훈련도 그렇게 하지 않는다 — 스타트 세션이라고 240m 만
 * 하고 나오지 않고, 앞뒤로 편하게 헤엄쳐 그날의 거리를 채운다.
 *
 * **반복 수를 늘려 채우지 않는다.** 반복 수는 분량 등급이 정하고(`mergedPoolSpec`),
 * 그 등급을 만드는 재료가 바로 이 '세션당 거리'다. 같은 값으로 반복 수를 다시 곱하면
 * 등급이 눌러 둔 상한을 등급의 재료가 뚫는다 — 주 2회 나오는 회원에게 레이스 페이스
 * 18회가 나가는 식이다. 채우는 것은 **강도가 아니라 거리**이므로 회복 스윔으로 채운다.
 *
 * 인터벌은 `recovery` 의 등급별 값을 그대로 쓴다. 두 축의 분리는 여기서도 유지된다.
 */
const FILLER_NOTE = '적어 주신 세션 거리를 채우는 자리입니다. 페이스를 재지 않습니다'

/** 모자란 거리를 50m 단위 반복 수로 바꾼다. 100m 미만이면 채우지 않는다(`null`). */
function fillerReps(qualityMeters: number, declaredMeters: number): number | null {
  if (!Number.isFinite(declaredMeters) || declaredMeters <= 0) return null

  const gap = Math.min(declaredMeters - qualityMeters, FILLER_MAX_METERS)
  const reps = Math.floor(gap / FILLER_STEP)
  return reps >= 2 ? reps : null
}

function buildSession(
  focus: SessionFocus,
  profile: Profile,
  grading: Grading,
  pace25Cs: number,
  format: SessionFormat,
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

  const repDistanceOf = (spec: PoolSpec): number => (spec.distance === 0 ? distance : spec.distance)

  const pool = poolIdsFor(focus, distance, grading.intensity)
    .map((id) => methodById(id))
    .filter((method): method is TrainingMethod => method !== undefined)
    .map((method) => ({ method, spec: mergedPoolSpec(method, grading.intensity, grading.volume) }))
    .filter((entry): entry is { method: TrainingMethod; spec: PoolSpec } => entry.spec !== null)

  const quality = pool.reduce((sum, { spec }) => sum + spec.reps * repDistanceOf(spec), 0)
  const extra = fillerReps(quality, profile.load.metersPerSession)

  // 이미 회복 스윔이 든 세션(지속력)은 **그 세트를 늘린다.** 뒤에 하나 더 붙이면
  // 같은 세트가 두 번 나오고, 건너뛰면 그 세션만 짧은 채로 남는다.
  const existing = extra === null ? -1 : pool.findIndex(({ method }) => method.id === 'recovery')

  pool.forEach(({ method, spec: base }, index) => {
    const grew = extra !== null && index === existing
    const spec = grew ? { ...base, reps: base.reps + extra } : base
    meters += spec.reps * repDistanceOf(spec)

    items.push({
      role: index === 0 ? 'main' : 'support',
      method,
      text: describePoolSet(spec, pace25Cs, distance),
      note: grew ? FILLER_NOTE : spec.note,
    })
  })

  // 회복 스윔이 없던 세션에는 이지 스윔을 한 줄 붙인다. 질 위주 세트 **뒤**,
  // 육상 **앞**이다 — 편한 헤엄으로 마무리하고 물에서 나와 육상을 한다.
  const recovery = methodById('recovery')
  const recoveryBase = recovery ? mergedPoolSpec(recovery, grading.intensity, grading.volume) : null
  if (extra !== null && existing < 0 && recovery && recoveryBase) {
    const spec = { ...recoveryBase, distance: FILLER_STEP, reps: extra }
    meters += extra * FILLER_STEP
    items.push({
      role: 'support',
      method: recovery,
      text: describePoolSet(spec, pace25Cs, distance),
      note: FILLER_NOTE,
    })
  }

  const after = methodById(drylandAfterFor(focus, format))
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

  // 마법사 이전에 저장한 프로필에는 이 둘이 없다. 그때와 같은 플랜이 나와야 한다.
  const purpose: Purpose = profile.purpose ?? 'faster'
  const format: SessionFormat = profile.format ?? 'pool'
  const priority = FOCUS_PRIORITY[purpose][event.distance]

  const sessions = Math.max(1, Math.min(7, Math.round(profile.load.sessionsPerWeek)))

  return Array.from({ length: sessions }, (_, index) =>
    buildSession(priority[index % priority.length]!, profile, grading, pace25Cs, format),
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
  // 드릴 위주라 기술 세션과 같은 강도다.
  breathing: 6.0,
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
