/**
 * 1차 뼈대 화면.
 *
 * 목표기록 하나를 받아 훈련 목표 페이스와 구간 목표를 보여준다.
 * 파이프라인(입력 → 순수 계산 → 저장 → 오프라인)이 끝까지 도는지 확인하는 게 목적이고,
 * 주간 플랜과 방법 카탈로그는 이 위에 붙는다.
 */
import { formatTime, improvementPercent, parseTime, racePace25, splitTargets } from './pace'
import { load, save } from './storage'
import type { Distance, Profile, Stroke } from './types'
import { STROKE_LABEL } from './types'

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`요소를 찾을 수 없습니다: #${id}`)
  return el as T
}

const strokeInput = $<HTMLSelectElement>('stroke')
const distanceInput = $<HTMLSelectElement>('distance')
const currentInput = $<HTMLInputElement>('current')
const targetInput = $<HTMLInputElement>('target')
const sessionsInput = $<HTMLInputElement>('sessions')
const result = $<HTMLElement>('result')

function render(): void {
  const stroke = strokeInput.value as Stroke
  const distance = Number(distanceInput.value) as Distance
  const targetCs = parseTime(targetInput.value)
  const currentCs = parseTime(currentInput.value)

  if (targetCs === null) {
    result.innerHTML = '<p class="hint">목표기록을 <code>1:23.45</code> 형식으로 넣어주세요.</p>'
    return
  }

  const pace = racePace25(targetCs, distance)
  const splits = splitTargets(targetCs, distance)
  const gap = currentCs !== null ? improvementPercent(currentCs, targetCs) : null

  result.innerHTML = `
    <div class="pace">
      <span class="pace-label">훈련 목표 페이스 · 25m</span>
      <strong class="pace-value">${formatTime(pace)}</strong>
      <span class="hint">벽에서 푸시오프로 출발했을 때 기준입니다.</span>
    </div>

    ${gap === null ? '' : `<p class="gap">현재기록 대비 <strong>${gap.toFixed(1)}%</strong> 단축이 필요합니다.</p>`}

    <h2>대회 구간 목표</h2>
    <table>
      <thead><tr><th>구간</th><th>랩</th><th>누적</th></tr></thead>
      <tbody>
        ${splits
          .map((cumulative, i) => {
            const lap = i === 0 ? cumulative : cumulative - splits[i - 1]!
            return `<tr><td>${(i + 1) * 25}m</td><td>${formatTime(lap)}</td><td>${formatTime(cumulative)}</td></tr>`
          })
          .join('')}
      </tbody>
    </table>
    <p class="hint">${STROKE_LABEL[stroke]} ${distance}m · 25m 단수로 기준</p>
  `

  const sessions = Number(sessionsInput.value)
  if (currentCs === null || !Number.isFinite(sessions)) return

  const profile: Profile = {
    // 연령부·성별은 등급 배정과 목표 검증에 필요하지만 2차 화면에서 받는다.
    ageGroup: '40-44',
    sex: 'M',
    goal: { event: { stroke, distance }, targetCs, currentCs },
    load: { sessionsPerWeek: sessions, metersPerSession: 0 },
  }
  save(profile)
}

function restore(): void {
  const { profile } = load()
  if (!profile) return

  strokeInput.value = profile.goal.event.stroke
  distanceInput.value = String(profile.goal.event.distance)
  currentInput.value = formatTime(profile.goal.currentCs)
  targetInput.value = formatTime(profile.goal.targetCs)
  sessionsInput.value = String(profile.load.sessionsPerWeek)
}

for (const el of [strokeInput, distanceInput, currentInput, targetInput, sessionsInput]) {
  el.addEventListener('input', render)
}

restore()
render()

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    // GitHub Pages 는 /<repo>/ 하위에 올라가므로 경로는 반드시 상대경로로 둔다.
    void navigator.serviceWorker.register('./sw.js')
  })
}
