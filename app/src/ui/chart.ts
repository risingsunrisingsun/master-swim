/**
 * 기록 추이 꺾은선. SVG 문자열만 만든다 — v1 `chart.ts` 의 형식을 이어받았다.
 *
 * - 한 번에 **한 종목**만. 계열이 하나라 범례 대신 아래에 점 모양 설명을 둔다.
 * - **y축을 뒤집는다.** 기록은 작을수록 좋으므로 위로 갈수록 빠르다.
 * - 출처는 점 모양으로 가른다: 모임 기록은 채운 점, 개인 입력은 빈 점(PRD-0001 §4.2).
 * - 최고기록을 새로 쓴 점에 고리를 두르고, 목표는 점선 기준선 하나.
 * - 값은 툴팁에만 두지 않는다 — 아래 기록표가 모든 값을 그대로 보여준다.
 */
import { formatTime } from '../core/time'
import type { RecordSource } from '../core/types'

export interface ChartPoint {
  date: string
  timeCs: number
  source: RecordSource
  /** 이 점에서 최고기록을 새로 썼다. */
  pb: boolean
}

const W = 320
const H = 200
const PAD = { top: 16, right: 52, bottom: 26, left: 44 }

const dayOf = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d) / 86_400_000
}

const shortDate = (date: string): string => {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

export function recordChartHtml(points: readonly ChartPoint[], goalCs: number | null): string {
  if (points.length < 2) {
    return `<p class="hint">이 기간에 기록이 ${points.length === 0 ? '없습니다' : '하나뿐입니다'}. 두 개 이상이면 추이가 그려집니다.</p>`
  }

  const times = points.map((p) => p.timeCs)
  // 목표가 기록에서 너무 멀면 선이 납작해진다. 가까울 때만 기준선을 그린다.
  const showGoal = goalCs !== null && goalCs >= Math.min(...times) * 0.9
  const values = showGoal ? [...times, goalCs] : times
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const span = Math.max(rawMax - rawMin, 50)
  const min = rawMin - span * 0.12
  const max = rawMax + span * 0.12

  const days = points.map((p) => dayOf(p.date))
  const dayMin = Math.min(...days)
  const dayRange = Math.max(Math.max(...days) - dayMin, 1)

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (date: string): number => PAD.left + ((dayOf(date) - dayMin) / dayRange) * plotW
  // 뒤집힌 y: 빠를수록 위.
  const y = (cs: number): number => PAD.top + ((cs - min) / (max - min)) * plotH
  const f = (n: number): string => n.toFixed(1)

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(x(p.date))} ${f(y(p.timeCs))}`).join(' ')

  const goal = showGoal
    ? `<line class="c-goal" x1="${PAD.left}" y1="${f(y(goalCs))}" x2="${PAD.left + plotW}" y2="${f(y(goalCs))}" />` +
      `<text class="c-goal-label" x="${PAD.left + plotW + 4}" y="${f(y(goalCs) + 4)}">목표</text>`
    : ''

  const marks = points
    .map((p) => {
      const cx = f(x(p.date))
      const cy = f(y(p.timeCs))
      const ring = p.pb ? `<circle class="c-pb" cx="${cx}" cy="${cy}" r="7" />` : ''
      const title = `${p.date} · ${formatTime(p.timeCs)} · ${p.source === 'meeting' ? '모임 기록' : '개인 입력'}${p.pb ? ' · 최고기록' : ''}`
      return (
        ring +
        `<circle class="c-dot c-${p.source}" cx="${cx}" cy="${cy}" r="4" />` +
        `<circle class="c-hit" cx="${cx}" cy="${cy}" r="12"><title>${title}</title></circle>`
      )
    })
    .join('')

  const last = points.at(-1)!
  const first = points[0]!
  const lastLabel = `<text class="c-value" x="${f(x(last.date) + 8)}" y="${f(y(last.timeCs) + 4)}">${formatTime(last.timeCs)}</text>`

  const axis =
    `<line class="c-axis" x1="${PAD.left}" y1="${PAD.top + plotH}" x2="${PAD.left + plotW}" y2="${PAD.top + plotH}" />` +
    `<text class="c-tick" x="${PAD.left}" y="${H - 8}">${shortDate(first.date)}</text>` +
    `<text class="c-tick c-tick-end" x="${PAD.left + plotW}" y="${H - 8}">${shortDate(last.date)}</text>` +
    `<text class="c-tick" x="4" y="${f(y(Math.min(...times)) + 4)}">${formatTime(Math.min(...times))}</text>` +
    `<text class="c-tick" x="4" y="${f(y(Math.max(...times)) + 4)}">${formatTime(Math.max(...times))}</text>`

  return `<figure class="chart">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="기록 추이 ${points.length}개. 위로 갈수록 빠릅니다.">
      ${goal}${axis}
      <path class="c-line" d="${path}" />
      ${marks}${lastLabel}
    </svg>
    <figcaption class="chart-legend">
      <span><i class="lg lg-meeting"></i>모임 기록</span>
      <span><i class="lg lg-self"></i>개인 입력</span>
      <span><i class="lg lg-pb"></i>최고기록 갱신</span>
      ${showGoal ? '<span><i class="lg lg-goal"></i>목표</span>' : ''}
    </figcaption>
  </figure>`
}
