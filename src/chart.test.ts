import { describe, expect, test } from 'bun:test'
import { EMPTY_CHART_HTML, recordChart, type ChartPoint } from './chart'

const points: ChartPoint[] = [
  { date: '2026-03-01', timeCs: 9100 },
  { date: '2026-05-01', timeCs: 8850 },
  { date: '2026-07-01', timeCs: 8710 },
]

/** SVG 안의 y 좌표를 순서대로 뽑는다. */
function lineYs(svg: string): number[] {
  const path = /<path class="c-line" d="([^"]+)"/.exec(svg)?.[1] ?? ''
  return [...path.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((match) => Number(match[2]))
}

describe('recordChart', () => {
  test('점이 두 개 미만이면 그리지 않는다', () => {
    expect(recordChart([])).toBe(EMPTY_CHART_HTML)
    expect(recordChart([points[0]!])).toBe(EMPTY_CHART_HTML)
  })

  test('y축이 뒤집혀 있다 — 빨라질수록 위로 간다', () => {
    const ys = lineYs(recordChart(points))
    // SVG 의 y 는 아래로 증가한다. 기록이 줄었으니 y 도 줄어야 위로 올라간다.
    expect(ys[1]!).toBeLessThan(ys[0]!)
    expect(ys[2]!).toBeLessThan(ys[1]!)
  })

  test('점 개수만큼 마크가 생긴다', () => {
    const svg = recordChart(points)
    expect(svg.match(/class="c-dot"/g)).toHaveLength(3)
  })

  test('손가락으로 누를 수 있는 히트영역이 마크보다 크다', () => {
    const svg = recordChart(points)
    const dot = Number(/class="c-dot"[^>]*r="([\d.]+)"/.exec(svg)![1])
    const hit = Number(/class="c-hit"[^>]*r="([\d.]+)"/.exec(svg)![1])
    expect(hit).toBeGreaterThan(dot * 2)
  })

  test('값 라벨은 마지막 점 하나에만 붙는다', () => {
    expect(recordChart(points).match(/class="c-value"/g)).toHaveLength(1)
  })

  test('최고기록이 끝점이 아니면 따로 표시한다', () => {
    const regressed = [...points, { date: '2026-08-01', timeCs: 9000 }]
    expect(recordChart(regressed)).toContain('c-best')
  })

  test('최고기록이 끝점이면 중복 표시하지 않는다', () => {
    expect(recordChart(points)).not.toContain('c-best')
  })

  test('등급 경계는 범위 안에 있는 것만 기준선으로 그린다', () => {
    const svg = recordChart(points, [
      { ceilingCs: 8800, label: '고급' }, // 범위 안
      { ceilingCs: 3000, label: '최상급' }, // 한참 밖
    ])
    expect(svg).toContain('고급')
    expect(svg).not.toContain('최상급')
  })

  test('시간 간격이 x 좌표에 반영된다 — 날짜를 등간격으로 두지 않는다', () => {
    const uneven = recordChart([
      { date: '2026-01-01', timeCs: 9000 },
      { date: '2026-01-02', timeCs: 8900 },
      { date: '2026-12-31', timeCs: 8800 },
    ])
    const xs = [...uneven.matchAll(/<circle class="c-dot" cx="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(xs[1]! - xs[0]!).toBeLessThan(xs[2]! - xs[1]!)
  })

  test('모든 기록이 같아도 깨지지 않는다', () => {
    const flat = recordChart([
      { date: '2026-01-01', timeCs: 9000 },
      { date: '2026-02-01', timeCs: 9000 },
    ])
    expect(flat).toContain('<svg')
    expect(flat).not.toContain('NaN')
  })

  test('대체 텍스트로 방향을 알려준다', () => {
    expect(recordChart(points)).toContain('위로 갈수록 빠릅니다')
  })
})
