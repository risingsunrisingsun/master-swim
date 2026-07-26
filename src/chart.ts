/**
 * 기록 추이 라인차트. SVG 문자열만 만든다 — DOM 도 외부 라이브러리도 쓰지 않는다.
 *
 * 형식 결정
 * - 한 번에 **한 종목**만 그린다. 계열이 하나이므로 범례가 없고, 끝점에 직접 라벨을 단다.
 * - **y축을 뒤집는다.** 기록은 작을수록 좋으므로, 위로 갈수록 빨라야 향상이 위로 읽힌다.
 * - 축은 하나뿐이다. 등급 경계는 두 번째 축이 아니라 같은 시간축 위의 수평 기준선이다.
 * - 색은 계열 하나(브랜드 블루)만 쓴다. 라이트 #0868e8 · 다크 #3987e5 로 검증했다.
 * - 값은 툴팁에만 두지 않는다 — 아래 표가 모든 값을 그대로 보여준다.
 */
import { formatTime } from './pace'

export interface ChartPoint {
  /** YYYY-MM-DD */
  date: string
  timeCs: number
  label?: string
}

export interface ChartBand {
  /** 이 등급의 상한 기록(centisecond) */
  ceilingCs: number
  label: string
}

const W = 320
const H = 190
const PAD = { top: 14, right: 46, bottom: 26, left: 40 }

const escape = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )

const dayOf = (date: string): number => new Date(`${date}T00:00:00`).getTime() / 86_400_000

const shortDate = (date: string): string => {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

export const EMPTY_CHART_HTML =
  '<p class="hint">기록을 두 개 이상 남기면 추이가 그려집니다.</p>'

/**
 * @param bands 등급 경계. 차트 범위 안에 들어오는 것만 기준선으로 그린다.
 */
export function recordChart(points: readonly ChartPoint[], bands: readonly ChartBand[] = []): string {
  if (points.length < 2) return EMPTY_CHART_HTML

  const times = points.map((point) => point.timeCs)
  const inRange = bands.filter(
    (band) => band.ceilingCs <= Math.max(...times) * 1.08 && band.ceilingCs >= Math.min(...times) * 0.92,
  )

  const values = [...times, ...inRange.map((band) => band.ceilingCs)]
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const span = Math.max(rawMax - rawMin, 50) // 기록이 거의 같아도 선이 납작해지지 않게
  const min = rawMin - span * 0.15
  const max = rawMax + span * 0.15

  const days = points.map((point) => dayOf(point.date))
  const dayMin = Math.min(...days)
  const dayRange = Math.max(Math.max(...days) - dayMin, 1)

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const x = (date: string): number => PAD.left + ((dayOf(date) - dayMin) / dayRange) * plotW
  // 뒤집힌 y: 값이 작을수록(빠를수록) 위로 간다.
  const y = (cs: number): number => PAD.top + ((cs - min) / (max - min)) * plotH

  const gridLines = inRange
    .map(
      (band) =>
        `<line class="c-grid" x1="${PAD.left}" y1="${y(band.ceilingCs).toFixed(1)}" x2="${PAD.left + plotW}" y2="${y(band.ceilingCs).toFixed(1)}" />` +
        `<text class="c-band" x="${PAD.left + plotW + 4}" y="${(y(band.ceilingCs) + 3).toFixed(1)}">${escape(band.label)}</text>`,
    )
    .join('')

  const path = points
    .map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.date).toFixed(1)} ${y(point.timeCs).toFixed(1)}`)
    .join(' ')

  const best = points.reduce((a, b) => (b.timeCs < a.timeCs ? b : a))
  const last = points.at(-1)!

  const markers = points
    .map((point) => {
      const cx = x(point.date).toFixed(1)
      const cy = y(point.timeCs).toFixed(1)
      const title = `${point.date} · ${formatTime(point.timeCs)}`
      return (
        `<circle class="c-dot" cx="${cx}" cy="${cy}" r="3.5" />` +
        // 손가락으로 누를 수 있도록 실제 마크보다 큰 히트영역을 겹쳐 둔다.
        `<circle class="c-hit" cx="${cx}" cy="${cy}" r="12"><title>${escape(title)}</title></circle>`
      )
    })
    .join('')

  // 라벨은 마지막 점에만 단다. 모든 점에 숫자를 붙이면 읽히지 않는다.
  const lastLabel =
    `<text class="c-value" x="${(x(last.date) + 6).toFixed(1)}" y="${(y(last.timeCs) - 6).toFixed(1)}">` +
    `${formatTime(last.timeCs)}</text>`

  const bestMark =
    best !== last
      ? `<circle class="c-best" cx="${x(best.date).toFixed(1)}" cy="${y(best.timeCs).toFixed(1)}" r="5.5" />`
      : ''

  const axis =
    `<line class="c-axis" x1="${PAD.left}" y1="${PAD.top + plotH}" x2="${PAD.left + plotW}" y2="${PAD.top + plotH}" />` +
    `<text class="c-tick" x="${PAD.left}" y="${H - 8}">${shortDate(points[0]!.date)}</text>` +
    `<text class="c-tick c-tick-end" x="${PAD.left + plotW}" y="${H - 8}">${shortDate(last.date)}</text>` +
    `<text class="c-tick" x="4" y="${(y(rawMin) + 3).toFixed(1)}">${formatTime(rawMin)}</text>` +
    `<text class="c-tick" x="4" y="${(y(rawMax) + 3).toFixed(1)}">${formatTime(rawMax)}</text>`

  return `<figure class="chart">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="기록 추이. 위로 갈수록 빠릅니다.">
      ${gridLines}${axis}
      <path class="c-line" d="${path}" />
      ${bestMark}${markers}${lastLabel}
    </svg>
    <figcaption class="hint">위로 갈수록 빠릅니다. 굵은 점이 최고기록입니다.</figcaption>
  </figure>`
}
