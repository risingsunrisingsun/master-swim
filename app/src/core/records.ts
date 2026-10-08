/**
 * 나의 기록 추이 (기능2). 순수 함수만.
 *
 * 개인 입력과 운영자 입력(정기모임 기록)은 한 줄로 섞어 본다. 최고기록(PB)은 출처를
 * 가리지 않는다 — 혼자 잰 기록도 내 기록이다. 출처는 화면이 점 모양으로 가른다.
 */
import { type Decade, findDistribution, percentileBeaten } from '../../../src/distributions'
import { addMonths, monthOf } from './dates'
import { eventKey, sameEvent } from './time'
import { type Goal, mastersAge, type Sex, SEX_LABEL, type SwimEvent, type SwimRecord } from './types'

export type Period = '3m' | '6m' | '1y' | 'all'

export const PERIOD_LABEL: Record<Period, string> = {
  '3m': '3개월',
  '6m': '6개월',
  '1y': '1년',
  all: '전체',
}

export const isPeriod = (value: string | null): value is Period => value !== null && Object.hasOwn(PERIOD_LABEL, value)

/** 이 날부터 보인다. 전체면 null. */
export function periodStart(period: Period, today: string): string | null {
  const months = { '3m': 3, '6m': 6, '1y': 12, all: 0 }[period]
  if (months === 0) return null
  return `${addMonths(monthOf(today), -months)}${today.slice(7)}`
}

/** 날짜 순. 같은 날이면 넣은 순서(입력 배열 순서)를 지킨다. */
export function byDate(records: readonly SwimRecord[]): SwimRecord[] {
  return [...records].sort((a, b) => a.date.localeCompare(b.date))
}

export function recordsOf(records: readonly SwimRecord[], event: SwimEvent): SwimRecord[] {
  return byDate(records.filter((r) => sameEvent(r, event)))
}

export function personalBest(records: readonly SwimRecord[], event: SwimEvent): SwimRecord | null {
  let best: SwimRecord | null = null
  for (const record of records) {
    if (sameEvent(record, event) && (best === null || record.timeCs < best.timeCs)) best = record
  }
  return best
}

/**
 * 그 시점에 최고기록을 새로 쓴 기록들의 id. 차트의 PB 마커가 이것이다.
 * 첫 기록도 PB 다 — 비교할 것이 없으면 그것이 최고다.
 */
export function pbIds(records: readonly SwimRecord[]): Set<string> {
  const ids = new Set<string>()
  const best = new Map<string, number>()
  for (const record of byDate(records)) {
    const key = eventKey(record)
    const previous = best.get(key)
    if (previous === undefined || record.timeCs < previous) {
      best.set(key, record.timeCs)
      ids.add(record.id)
    }
  }
  return ids
}

/** 기록이 있는 종목, 마지막으로 기록한 순. 화면이 처음 고를 종목이 맨 앞이다. */
export function eventsByRecency(records: readonly SwimRecord[]): SwimEvent[] {
  const seen = new Map<string, SwimEvent>()
  for (const record of byDate(records).reverse()) {
    const key = eventKey(record)
    if (!seen.has(key)) seen.set(key, { stroke: record.stroke, distance: record.distance })
  }
  return [...seen.values()]
}

/** 가장 최근에 새로 쓴 최고기록. 홈 화면용. */
export function latestPb(records: readonly SwimRecord[]): SwimRecord | null {
  const ids = pbIds(records)
  return byDate(records.filter((r) => ids.has(r.id))).at(-1) ?? null
}

export interface GoalGap {
  goal: Goal
  best: SwimRecord | null
  /** 남은 cs. 이미 닿았으면 0 이하. 기록이 없으면 null. */
  remainingCs: number | null
}

/** 가장 최근에 정한 목표와 지금 최고기록의 차이. 홈 화면용. */
export function latestGoalGap(goals: readonly Goal[], records: readonly SwimRecord[]): GoalGap | null {
  const goal = [...goals].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  if (!goal) return null
  const best = personalBest(records, goal)
  return { goal, best, remainingCs: best ? best.timeCs - goal.targetCs : null }
}

// ── 국내 마스터즈 위치 ───────────────────────────────────────

export interface NationalStanding {
  /** 상위 몇 %. 작을수록 빠르다. */
  topPercent: number
  sampleSize: number
  /** `남자 40대` */
  group: string
}

/**
 * v1 의 마이랭킹 기록 분포로 상위 % 를 낸다(ADR-0006). **보조 정보 한 줄**이다(PRD-0001 §4.2).
 *
 * 분포가 있는 것은 50m 네 영법뿐이고, 성별 · 출생연도를 운영자가 넣은 회원에게만 보인다.
 * 그 밖에는 null — 등급 구간으로 꾸민 숫자를 백분위처럼 보이지 않는다.
 */
export function nationalStanding(
  timeCs: number,
  event: SwimEvent,
  sex: Sex | null,
  birthYear: number | null,
  today: string,
): NationalStanding | null {
  if (sex === null || birthYear === null || event.stroke === 'im') return null
  const decade = decadeOfAge(mastersAge(birthYear, today))
  const dist = findDistribution(event.stroke, event.distance, sex, decade)
  if (!dist) return null
  const top = 100 - percentileBeaten(timeCs, dist)
  return {
    topPercent: Math.max(1, Math.round(top)),
    sampleSize: dist.total,
    group: `${SEX_LABEL[sex]}자 ${decade}대${decade === 60 ? ' 이상' : ''}`,
  }
}

/** 분포 원본의 연대 묶음. 20대 미만은 20대, 70대 이상은 60대 분포를 쓴다. */
function decadeOfAge(age: number): Decade {
  if (age < 30) return 20
  if (age < 40) return 30
  if (age < 50) return 40
  if (age < 60) return 50
  return 60
}
