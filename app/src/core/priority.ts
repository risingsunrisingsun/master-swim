/**
 * 최우선 훈련 한 가지 — 순수 함수만.
 *
 * "지금 무엇부터 해야 하나?"에 **이미 있는 기록만으로** 답한다. CONTEXT.md 가 3차로 미뤄 둔
 * 병목 진단(스플릿 · 스트로크 수)을 입력 부담 없이 가볍게 앞당긴 판이다. 공식만 쓴다(ADR-0001).
 *
 * 진단 넷을 정해진 순서로 본다 — 후반 감속 · 스피드 천장 · 정체 · 영법 균형.
 * 순서가 곧 우선순위다. 같은 영법에서 후반이 무너지면 천장을 올려도 레이스에서 쓰지 못하므로
 * 후반 감속이 먼저 온다. 판단할 기록이 없으면 추측하지 않고 **무엇을 재 달라고** 묻는다.
 *
 * 기준값(ENDURANCE_RATIO 등)은 세트 공식(FORMULA)처럼 **잠정값**이다. 코치와 정한다(PRD-0001 §11-1).
 */
import { shortDateLabel } from './dates'
import { nationalStanding, personalBest, recordsOf } from './records'
import { eventLabel, formatTime } from './time'
import { type Sex, STROKE_LABEL, type Stroke, type SwimEvent, type SwimRecord } from './types'

export type FindingKind = 'endurance' | 'speed' | 'plateau' | 'balance'
/** focus = 이것부터, ok = 괜찮음, need-data = 판단할 기록이 모자람. */
export type FindingStatus = 'focus' | 'ok' | 'need-data'

export interface Finding {
  kind: FindingKind
  status: FindingStatus
  /** focus 면 회원이 할 일('후반 25m 버티기'), 아니면 진단 이름('후반 감속'). */
  title: string
  /** 숫자로 된 근거 한 줄. */
  detail: string
  /** 이 진단을 따를 때 세트 탭에서 볼 종목. 없으면 null. */
  event: SwimEvent | null
}

export interface Diagnosis {
  /** 첫 번째 focus. 없으면 null. */
  primary: Finding | null
  /** 언제나 넷 — endurance, speed, plateau, balance 순. */
  findings: Finding[]
}

/**
 * 잠정값 · 코치와 정한다. 100m 최고가 50m 최고 × 2 × 이 값 안이면 후반 감속은 양호하다.
 * 100m 에는 다이빙이 한 번뿐이고 턴이 셋이라 50m 두 배보다 느린 것이 정상이다 — 그 정상 폭을 12% 로 잡았다.
 */
export const ENDURANCE_RATIO = 1.12
/** 이 날수보다 오래 PB 가 그대로면 정체를 의심한다. */
export const PLATEAU_DAYS = 180
/** 정체라고 부르려면 PB 뒤로 이만큼은 재 봤어야 한다. 한두 번 못 줄인 것은 정체가 아니다. */
export const PLATEAU_MIN_RECORDS = 3
/** 50m 네 영법 상위 % 차이(퍼센트 포인트). 이보다 벌어지면 처지는 영법을 짚는다. */
export const BALANCE_GAP = 25

const STROKES: readonly Exclude<Stroke, 'im'>[] = ['free', 'back', 'breast', 'fly']

const sec = (cs: number): string => (cs / 100).toFixed(2)

export function diagnose(
  records: readonly SwimRecord[],
  event: SwimEvent,
  sex: Sex | null,
  birthYear: number | null,
  today: string,
): Diagnosis {
  const endurance = enduranceFinding(records, event.stroke)
  const findings = [
    endurance,
    speedFinding(records, event.stroke, endurance, sex, birthYear, today),
    plateauFinding(records, event, today),
    balanceFinding(records, sex, birthYear, today),
  ]
  return { primary: findings.find((f) => f.status === 'focus') ?? null, findings }
}

// ── 후반 감속 ────────────────────────────────────────────────

function enduranceFinding(records: readonly SwimRecord[], stroke: Stroke): Finding {
  const e50: SwimEvent = { stroke, distance: 50 }
  const e100: SwimEvent = { stroke, distance: 100 }
  const b50 = personalBest(records, e50)
  const b100 = personalBest(records, e100)
  if (!b50 || !b100) {
    const missing = !b100 ? e100 : e50
    return {
      kind: 'endurance',
      status: 'need-data',
      title: '후반 감속',
      detail: `${eventLabel(missing)} 기록을 한 번 재 보세요. 50m 와 100m 가 둘 다 있어야 후반을 봅니다.`,
      event: missing,
    }
  }
  const drop = b100.timeCs - 2 * b50.timeCs
  const allowed = Math.round(2 * b50.timeCs * (ENDURANCE_RATIO - 1))
  const head = `${eventLabel(e100)} 최고 ${formatTime(b100.timeCs)}, 50m 최고 ${formatTime(b50.timeCs)}의 두 배보다 ${sec(drop)}초 느립니다. 기준은 ${sec(allowed)}초입니다.`
  return drop > allowed
    ? { kind: 'endurance', status: 'focus', title: '후반 25m 버티기', detail: head, event: e100 }
    : { kind: 'endurance', status: 'ok', title: '후반 감속', detail: head, event: e100 }
}

// ── 스피드 천장 ──────────────────────────────────────────────

function speedFinding(
  records: readonly SwimRecord[],
  stroke: Stroke,
  endurance: Finding,
  sex: Sex | null,
  birthYear: number | null,
  today: string,
): Finding {
  const e50: SwimEvent = { stroke, distance: 50 }
  if (endurance.status === 'focus') {
    // 한 영법에 할 일 둘을 겹쳐 내지 않는다 — 후반이 무너지면 천장을 올려도 레이스에서 못 쓴다.
    return {
      kind: 'speed',
      status: 'ok',
      title: '스피드 천장',
      detail: '후반 25m 를 먼저 버틴 뒤에 봅니다.',
      event: e50,
    }
  }
  if (endurance.status === 'ok') {
    return {
      kind: 'speed',
      status: 'focus',
      title: '최고 속도 올리기',
      detail: `${STROKE_LABEL[stroke]} 100m 는 50m 만큼 버팁니다. 이제 기록을 막는 것은 50m 최고 속도입니다.`,
      event: e50,
    }
  }
  // 100m 가 없어 후반을 볼 수 없다 — 50m 만으로 국내 분포에서의 위치를 본다.
  const b50 = personalBest(records, e50)
  const standing = b50 ? nationalStanding(b50.timeCs, e50, sex, birthYear, today) : null
  if (!b50 || !standing) {
    return {
      kind: 'speed',
      status: 'need-data',
      title: '스피드 천장',
      detail: !b50
        ? `${eventLabel(e50)} 기록을 한 번 재 보세요.`
        : '성별 · 출생연도가 있어야 50m 속도를 국내 기록과 견줍니다. 운영진에게 알려 주세요.',
      event: e50,
    }
  }
  const head = `${eventLabel(e50)} 최고 ${formatTime(b50.timeCs)}, 국내 마스터즈 ${standing.group} 상위 ${standing.topPercent}%입니다.`
  return standing.topPercent > 50
    ? { kind: 'speed', status: 'focus', title: '최고 속도 올리기', detail: head, event: e50 }
    : { kind: 'speed', status: 'ok', title: '스피드 천장', detail: head, event: e50 }
}

// ── 정체 ─────────────────────────────────────────────────────

function plateauFinding(records: readonly SwimRecord[], event: SwimEvent, today: string): Finding {
  const list = recordsOf(records, event)
  if (list.length < PLATEAU_MIN_RECORDS) {
    return {
      kind: 'plateau',
      status: 'need-data',
      title: '정체',
      detail: `${eventLabel(event)} 기록이 ${PLATEAU_MIN_RECORDS}개 넘게 쌓이면 봅니다. 지금 ${list.length}개입니다.`,
      event,
    }
  }
  // 날짜 순으로 넘겨 같은 기록이면 먼저 낸 날을 PB 로 본다.
  const pb = personalBest(list, event)!
  const since = list.filter((r) => r.date > pb.date).length
  const age = daysBetween(pb.date, today)
  if (age > PLATEAU_DAYS && since >= PLATEAU_MIN_RECORDS) {
    return {
      kind: 'plateau',
      status: 'focus',
      title: '자극 바꾸기',
      detail: `${eventLabel(event)} 최고기록 ${formatTime(pb.timeCs)} (${shortDateLabel(pb.date)}) 뒤로 ${since}번 재는 동안 줄지 않았습니다. 다른 성격의 세트를 앞에 두세요.`,
      event,
    }
  }
  return {
    kind: 'plateau',
    status: 'ok',
    title: '정체',
    detail: `최고기록 ${formatTime(pb.timeCs)} · ${shortDateLabel(pb.date)}에 냈습니다.`,
    event,
  }
}

/** ISO 날짜 사이 날수. 시간대가 끼지 않게 UTC 자정끼리 뺀다. */
function daysBetween(from: string, to: string): number {
  const utc = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

// ── 영법 균형 ────────────────────────────────────────────────

function balanceFinding(records: readonly SwimRecord[], sex: Sex | null, birthYear: number | null, today: string): Finding {
  if (sex === null || birthYear === null) {
    return {
      kind: 'balance',
      status: 'need-data',
      title: '영법 균형',
      detail: '성별 · 출생연도가 있어야 영법끼리 국내 기록 위치를 견줍니다. 운영진에게 알려 주세요.',
      event: null,
    }
  }
  const standings = STROKES.flatMap((stroke) => {
    const event: SwimEvent = { stroke, distance: 50 }
    const best = personalBest(records, event)
    const standing = best ? nationalStanding(best.timeCs, event, sex, birthYear, today) : null
    return standing ? [{ stroke, topPercent: standing.topPercent }] : []
  })
  if (standings.length < 2) {
    return {
      kind: 'balance',
      status: 'need-data',
      title: '영법 균형',
      detail: '다른 영법 50m 기록이 하나 더 있어야 견줍니다.',
      event: null,
    }
  }
  // topPercent 는 작을수록 빠르다. 가장 처지는 영법 = 가장 큰 값.
  const sorted = [...standings].sort((a, b) => a.topPercent - b.topPercent)
  const strong = sorted[0]!
  const weak = sorted.at(-1)!
  const gap = weak.topPercent - strong.topPercent
  const head = `${STROKE_LABEL[weak.stroke]} 50m 상위 ${weak.topPercent}% · ${STROKE_LABEL[strong.stroke]} 50m 상위 ${strong.topPercent}% — ${gap}%p 차이입니다.`
  return gap >= BALANCE_GAP
    ? {
        kind: 'balance',
        status: 'focus',
        title: `${STROKE_LABEL[weak.stroke]} 끌어올리기`,
        detail: head,
        event: { stroke: weak.stroke, distance: 50 },
      }
    : { kind: 'balance', status: 'ok', title: '영법 균형', detail: head, event: null }
}
