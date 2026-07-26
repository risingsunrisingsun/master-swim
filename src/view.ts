/**
 * 화면 HTML 생성.
 *
 * DOM 을 만지지 않는 순수 함수만 둔다 — 브라우저 없이 테스트할 수 있어야 하고,
 * `main.ts` 는 이 결과를 붙이는 배선만 담당한다.
 */
import type { Grading } from './grading'
import { formatTime, improvementPercent, racePace25, splitTargets } from './pace'
import { weeklyMeters, type PlannedSession } from './plan'
import type { Distance, Profile } from './types'
import { LEVEL_LABEL, STROKE_LABEL } from './types'

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** 카탈로그 문구는 우리가 쓴 것이지만, 이스케이프는 습관으로 둔다. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ENTITIES[char]!)
}

const ROLE_LABEL = {
  warmup: '준비',
  main: '주 세트',
  support: '보조',
  after: '마무리',
} as const

const meters = (value: number): string => `${value.toLocaleString('ko-KR')}m`

export function sessionHtml(session: PlannedSession, index: number): string {
  const rows = session.items
    .map(
      (item) => `<li>
          <span class="role">${ROLE_LABEL[item.role]}</span>
          <span class="item">
            <strong>${escapeHtml(item.method.name)}</strong>
            <span class="set">${escapeHtml(item.text)}</span>
            ${item.note ? `<span class="hint">${escapeHtml(item.note)}</span>` : ''}
          </span>
        </li>`,
    )
    .join('')

  return `<article class="session">
      <h3>${index + 1}일차 · ${escapeHtml(session.title)} <span class="meters">${meters(session.meters)}</span></h3>
      <ul>${rows}</ul>
    </article>`
}

export function gradingHtml(grading: Grading): string {
  return `<div class="grades">
      <span>강도 <strong>${LEVEL_LABEL[grading.intensity]}</strong></span>
      <span>분량 <strong>${LEVEL_LABEL[grading.volume]}</strong></span>
    </div>
    ${grading.mismatch ? `<p class="mismatch">${escapeHtml(grading.mismatch)}</p>` : ''}`
}

export function splitsHtml(targetCs: number, distance: Distance): string {
  const splits = splitTargets(targetCs, distance)
  const rows = splits
    .map((cumulative, index) => {
      const lap = index === 0 ? cumulative : cumulative - splits[index - 1]!
      return `<tr><td>${(index + 1) * 25}m</td><td>${formatTime(lap)}</td><td>${formatTime(cumulative)}</td></tr>`
    })
    .join('')

  return `<h2>대회 구간 목표</h2>
    <table>
      <thead><tr><th>구간</th><th>랩</th><th>누적</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
}

export const NEEDS_INPUT_HTML =
  '<p class="hint">현재기록과 목표기록을 <code>1:23.45</code> 형식으로 넣어주세요.</p>'

/** 결과 영역 전체. */
export function resultHtml(
  profile: Profile,
  grading: Grading,
  plan: readonly PlannedSession[],
): string {
  const { event, targetCs, currentCs } = profile.goal
  const pace = racePace25(targetCs, event.distance)
  const gap = improvementPercent(currentCs, targetCs)
  const planned = weeklyMeters(plan)
  const declared = profile.load.sessionsPerWeek * profile.load.metersPerSession

  return `<div class="pace">
      <span class="pace-label">훈련 목표 페이스 · 25m</span>
      <strong class="pace-value">${formatTime(pace)}</strong>
      <span class="hint">벽에서 푸시오프로 출발했을 때 기준입니다.</span>
    </div>

    <p class="gap">
      ${STROKE_LABEL[event.stroke]} ${event.distance}m · 현재기록 대비
      <strong>${gap.toFixed(1)}%</strong> 단축이 필요합니다.
    </p>

    ${gradingHtml(grading)}

    <h2>이번 주 플랜 <span class="hint">계획 ${meters(planned)} / 입력 ${meters(declared)}</span></h2>
    ${plan.map(sessionHtml).join('')}

    ${splitsHtml(targetCs, event.distance)}`
}
