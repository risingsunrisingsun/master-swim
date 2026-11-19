/**
 * 단체전 최적 명단. 순수 함수만.
 *
 * 출전 가능한 회원의 **50m 최고기록**으로 계영 4×50m(자유형) · 혼계영 4×50m(배-평-접-자)의
 * 가장 빠른 조합을 찾는다. 30명이면 전부 따져 봐도 순식간이라 근사 알고리즘을 쓰지 않는다.
 *
 * - 예상 기록 = 네 영자의 50m 최고기록 합 − 2~4번 영자의 인계 출발 보정 × 3.
 *   보정값은 **잠정값**이고 코치 계수다(`DEFAULT_TAKEOVER_CS`). 화면이 함께 밝힌다.
 * - 여러 팀이면 욕심 방식으로 나눈다 — 가장 빠른 팀을 먼저 뽑고, 그 네 명을 빼고 다시 뽑는다.
 *   전체 합을 최소로 나누는 방식이 아니다. 동호회 대회는 A팀이 가장 빨라야 하는 경우가 많다.
 * - 다른 회원의 이름과 기록이 함께 나오므로 운영자 화면에서만 쓴다(PRD-0001 §2).
 */
import type { Sex, Stroke, SwimRecord } from './types'

export type RelayStroke = Exclude<Stroke, 'im'>
/** 계영 4×50m 자유형 · 혼계영 4×50m. */
export type RelayKind = 'free' | 'medley'
/** X 는 혼성 — 남자 2 + 여자 2. */
export type RelayGender = 'M' | 'F' | 'X'

export const RELAY_KIND_LABEL: Record<RelayKind, string> = {
  free: '계영 4×50m',
  medley: '혼계영 4×50m',
}

export const RELAY_GENDER_LABEL: Record<RelayGender, string> = {
  M: '남자',
  F: '여자',
  X: '혼성',
}

/** 혼계영 영법 순서. */
export const MEDLEY_ORDER: readonly RelayStroke[] = ['back', 'breast', 'fly', 'free']

/** 2~4번 영자의 인계 출발이 평영 출발보다 빠른 폭(cs). 잠정값 — 코치와 정한다. */
export const DEFAULT_TAKEOVER_CS = 50

export interface RelaySwimmer {
  memberId: string
  name: string
  sex: Sex | null
  birthYear: number | null
  /** 영법별 50m 최고기록(cs). 기록이 없는 영법은 빠져 있다. */
  bests: Partial<Record<RelayStroke, number>>
}

export interface RelayOptions {
  kind: RelayKind
  gender: RelayGender
  /** 연령 합 구분(대회 요강). 둘 다 null 이면 따지지 않는다. */
  ageMin: number | null
  ageMax: number | null
  /** 마스터즈 나이를 셀 해. 나이 = year − 출생연도. */
  year: number
  takeoverCs: number
  /** 몇 팀까지 뽑을지(1~3). */
  teams: number
}

export interface RelayLeg {
  stroke: RelayStroke
  swimmer: RelaySwimmer
  /** 그 영자의 50m 최고기록 그대로(보정 전). */
  splitCs: number
}

export interface RelayTeam {
  /** 영법 순서대로 네 명. */
  legs: RelayLeg[]
  /** 네 기록의 합. */
  rawCs: number
  /** rawCs − 인계 보정 × 3. 화면의 예상 기록. */
  totalCs: number
  /** 연령 합. 네 명 중 출생연도를 모르는 사람이 있으면 null. */
  ageSum: number | null
}

export interface RelayExcluded {
  name: string
  reason: string
}

export interface RelayResult {
  teams: RelayTeam[]
  /** 후보에서 빠진 사람과 까닭. 성별이 다른 사람(남자 계영의 여자 회원)은 적지 않는다. */
  excluded: RelayExcluded[]
  /** 후보로 남은 사람 수. */
  candidates: number
}

const RELAY_STROKES: readonly RelayStroke[] = ['free', 'back', 'breast', 'fly']

/** 그 회원의 영법별 50m 최고기록. `since` 이후 기록만(null 이면 전부). 25 · 100m 와 개인혼영은 보지 않는다. */
export function relayBests(
  records: readonly SwimRecord[],
  memberId: string,
  since: string | null,
): Partial<Record<RelayStroke, number>> {
  const bests: Partial<Record<RelayStroke, number>> = {}
  for (const r of records) {
    if (r.memberId !== memberId || r.distance !== 50 || r.stroke === 'im') continue
    if (since !== null && r.date < since) continue
    const current = bests[r.stroke]
    if (current === undefined || r.timeCs < current) bests[r.stroke] = r.timeCs
  }
  return bests
}

export function bestRelayTeams(swimmers: readonly RelaySwimmer[], options: RelayOptions): RelayResult {
  const ageLimited = options.ageMin !== null || options.ageMax !== null
  const excluded: RelayExcluded[] = []
  let pool: RelaySwimmer[] = []

  for (const s of swimmers) {
    if (s.sex === null) {
      excluded.push({ name: s.name, reason: '성별 미입력' })
      continue
    }
    if (options.gender !== 'X' && s.sex !== options.gender) continue
    if (ageLimited && s.birthYear === null) {
      excluded.push({ name: s.name, reason: '출생연도 미입력' })
      continue
    }
    if (options.kind === 'free' && s.bests.free === undefined) {
      excluded.push({ name: s.name, reason: '자유형 50m 기록 없음' })
      continue
    }
    if (options.kind === 'medley' && !RELAY_STROKES.some((stroke) => s.bests[stroke] !== undefined)) {
      excluded.push({ name: s.name, reason: '50m 기록 없음' })
      continue
    }
    pool.push(s)
  }

  const candidates = pool.length
  const teams: RelayTeam[] = []
  const wanted = Math.min(3, Math.max(1, Math.floor(options.teams)))
  while (teams.length < wanted) {
    const team = options.kind === 'free' ? bestFree(pool, options) : bestMedley(pool, options)
    if (!team) break
    teams.push(team)
    const used = new Set(team.legs.map((leg) => leg.swimmer.memberId))
    pool = pool.filter((s) => !used.has(s.memberId))
  }

  return { teams, excluded, candidates }
}

// ── 탐색 ────────────────────────────────────────────────────

const ageOf = (s: RelaySwimmer, year: number): number | null => (s.birthYear === null ? null : year - s.birthYear)

/** 성별 · 연령 합 조건을 네 명이 다 찼을 때 확인한다. */
function fits(four: readonly RelaySwimmer[], options: RelayOptions): boolean {
  if (options.gender === 'X') {
    const men = four.filter((s) => s.sex === 'M').length
    if (men !== 2) return false
  }
  if (options.ageMin !== null || options.ageMax !== null) {
    const sum = ageSum(four, options.year)
    if (sum === null) return false
    if (options.ageMin !== null && sum < options.ageMin) return false
    if (options.ageMax !== null && sum > options.ageMax) return false
  }
  return true
}

function ageSum(four: readonly RelaySwimmer[], year: number): number | null {
  let sum = 0
  for (const s of four) {
    const age = ageOf(s, year)
    if (age === null) return null
    sum += age
  }
  return sum
}

/** 혼성이면 한 성별이 셋 이상 들어가는 순간 가지를 친다. */
function genderOk(chosen: readonly RelaySwimmer[], options: RelayOptions): boolean {
  if (options.gender !== 'X') return true
  let men = 0
  for (const s of chosen) if (s.sex === 'M') men++
  return men <= 2 && chosen.length - men <= 2
}

const byTimeThenId = (stroke: RelayStroke) => (a: RelaySwimmer, b: RelaySwimmer) =>
  a.bests[stroke]! - b.bests[stroke]! || a.memberId.localeCompare(b.memberId)

/** 같은 합이면 영법 순서대로 회원 id 를 이어 붙인 값이 작은 쪽. 테스트가 흔들리지 않게. */
function better(raw: number, key: string, best: { raw: number; key: string } | null): boolean {
  return best === null || raw < best.raw || (raw === best.raw && key < best.key)
}

/**
 * 혼계영. 영법마다 다른 사람을 고르는 배정 문제다 — 영법별로 가장 빠른 사람을 따로 뽑으면
 * 한 사람이 두 영법에 걸린다. 영법 순서대로 깊이 우선으로 고르고, 지금까지의 합 + 남은 영법의
 * 가장 빠른 기록이 이미 찾은 답보다 크면 가지를 친다.
 */
function bestMedley(pool: readonly RelaySwimmer[], options: RelayOptions): RelayTeam | null {
  const lists = MEDLEY_ORDER.map((stroke) => pool.filter((s) => s.bests[stroke] !== undefined).sort(byTimeThenId(stroke)))
  if (lists.some((list) => list.length === 0)) return null
  // 남은 영법들의 하한: 그 영법의 가장 빠른 기록 합.
  const floor = MEDLEY_ORDER.map((_, i) =>
    MEDLEY_ORDER.slice(i).reduce((sum, stroke, j) => sum + lists[i + j]![0]!.bests[stroke]!, 0),
  )
  floor.push(0)

  let best: { raw: number; key: string; four: RelaySwimmer[] } | null = null
  const chosen: RelaySwimmer[] = []

  const walk = (depth: number, sum: number): void => {
    if (depth === MEDLEY_ORDER.length) {
      if (!fits(chosen, options)) return
      const key = chosen.map((s) => s.memberId).join('|')
      if (better(sum, key, best)) best = { raw: sum, key, four: [...chosen] }
      return
    }
    const stroke = MEDLEY_ORDER[depth]!
    for (const s of lists[depth]!) {
      const next = sum + s.bests[stroke]!
      // 정렬돼 있으므로 이 사람에서 넘치면 뒤 사람도 넘친다. 같은 합은 키 비교를 위해 남긴다.
      if (best !== null && next + floor[depth + 1]! > best.raw) break
      if (chosen.includes(s)) continue
      chosen.push(s)
      if (genderOk(chosen, options)) walk(depth + 1, next)
      chosen.pop()
    }
  }
  walk(0, 0)

  if (!best) return null
  const four = (best as { four: RelaySwimmer[] }).four
  return team(
    MEDLEY_ORDER.map((stroke, i) => ({ stroke, swimmer: four[i]!, splitCs: four[i]!.bests[stroke]! })),
    options,
  )
}

/** 계영. 자유형 기록 순으로 네 명을 고르는 조합이다. */
function bestFree(pool: readonly RelaySwimmer[], options: RelayOptions): RelayTeam | null {
  const list = [...pool].sort(byTimeThenId('free'))
  if (list.length < 4) return null
  const time = (s: RelaySwimmer) => s.bests.free!

  let best: { raw: number; key: string; four: RelaySwimmer[] } | null = null
  const chosen: RelaySwimmer[] = []

  const walk = (start: number, sum: number): void => {
    if (chosen.length === 4) {
      if (!fits(chosen, options)) return
      const key = chosen.map((s) => s.memberId).join('|')
      if (better(sum, key, best)) best = { raw: sum, key, four: [...chosen] }
      return
    }
    const need = 4 - chosen.length
    for (let i = start; i <= list.length - need; i++) {
      const s = list[i]!
      // 남은 자리는 적어도 이 사람만큼 걸린다(정렬돼 있다).
      if (best !== null && sum + time(s) * need > best.raw) break
      chosen.push(s)
      if (genderOk(chosen, options)) walk(i + 1, sum + time(s))
      chosen.pop()
    }
  }
  walk(0, 0)

  if (!best) return null
  return team(freeOrder((best as { four: RelaySwimmer[] }).four).map((s) => ({ stroke: 'free' as const, swimmer: s, splitCs: time(s) })), options)
}

/**
 * 계영 영자 순서. 가장 빠른 사람이 마지막(앵커), 두 번째로 빠른 사람이 첫 번째,
 * 남은 둘 중 느린 사람이 두 번째, 나머지가 세 번째. 첫 영자가 앞서 나가 자리를 잡고
 * 앵커가 마무리하는 흔한 배치다. 합에는 영향이 없다.
 */
function freeOrder(four: readonly RelaySwimmer[]): RelaySwimmer[] {
  const [a, b, c, d] = four // 이미 빠른 순
  return [b!, d!, c!, a!]
}

function team(legs: RelayLeg[], options: RelayOptions): RelayTeam {
  const rawCs = legs.reduce((sum, leg) => sum + leg.splitCs, 0)
  return {
    legs,
    rawCs,
    totalCs: rawCs - 3 * options.takeoverCs,
    ageSum: ageSum(
      legs.map((leg) => leg.swimmer),
      options.year,
    ),
  }
}
