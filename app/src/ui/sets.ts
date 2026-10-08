/**
 * 세트 화면 (기능1) — 회원의 단축 세트, 운영자의 코치 조정.
 *
 * 화면은 그 묶음이 "공식 기본값"인지 "코치 처방"인지 항상 밝힌다(PRD-0001 §4.1).
 * 내부 등급(초급 · 최상급)은 보여주지 않는다 — 회원이 쓰는 말이 아니다(PRD-0001 §5).
 */
import { shortDateLabel } from '../core/dates'
import {
  BRACKET_LABEL,
  BRACKETS,
  type Bracket,
  clockLabel,
  EFFORT_LABEL,
  type LineView,
  PLAN_LINES_MAX,
  type Prescription,
  SET_DISTANCES,
  type SetEffort,
  type SetLine,
  type SetPlan,
  type Step,
} from '../core/sets'
import { eventKey, eventLabel, formatTime, SET_EVENTS } from '../core/time'
import type { SwimEvent, SwimRecord } from '../core/types'
import { timeInputsHtml } from './records'
import { adminHeadHtml, errorHtml, esc } from './views'

const seconds = (cs: number): string => (cs / 100).toFixed(2)

function eventSelect(id: string, selected: SwimEvent, nav: string): string {
  const options = SET_EVENTS.map((e) => {
    const key = eventKey(e)
    return `<option value="${key}"${key === eventKey(selected) ? ' selected' : ''}>${eventLabel(e)}</option>`
  }).join('')
  return `<select id="${id}" data-nav="${nav}">${options}</select>`
}

// ── 회원: 기록 단축 세트 ─────────────────────────────────────

export interface SetsView {
  event: SwimEvent
  /** 이 종목 최고기록. 없으면 처방을 못 한다. */
  best: SwimRecord | null
  /** 저장된 목표. 없으면 1초 단축으로 보여준다. */
  goalCs: number | null
  /** 목표가 지금 기록보다 빠를 때만. */
  prescription: Prescription | null
  error: string | null
}

export function setsHtml(view: SetsView): string {
  const key = eventKey(view.event)
  const head = `<header class="page-head"><h1>기록 단축 세트</h1></header>`
  const picker = `<div class="field">
      <label for="sets-event">종목</label>
      ${eventSelect('sets-event', view.event, 'sets')}
    </div>`

  if (!view.best) {
    return `${head}<div class="page-body">
        ${picker}
        <section class="card soft stack-s">
          <p>${eventLabel(view.event)} 기록이 아직 없습니다.</p>
          <p class="small muted">지금 기록이 있어야 1초씩 줄이는 세트를 계산할 수 있습니다.</p>
        </section>
        <a class="button primary" href="#/records/new?e=${key}">${eventLabel(view.event)} 기록 넣기</a>
      </div>`
  }

  const best = view.best
  const target = view.goalCs ?? best.timeCs - 100
  const shortcuts = [1, 2, 3]
    .filter((n) => best.timeCs - n * 100 > 0)
    .map(
      (n) =>
        `<button type="button" class="button small-button" data-action="goal-shortcut" data-cs="${best.timeCs - n * 100}" data-distance="${view.event.distance}">${n}초 단축</button>`,
    )
    .join('')

  const form = `<form id="goal-form" class="card stack" novalidate>
      <input type="hidden" name="event" value="${key}" />
      <div class="row baseline">
        <div>
          <p class="small muted">지금 최고기록</p>
          <p class="pb-number num">${formatTime(best.timeCs)}</p>
        </div>
        <p class="small muted">${shortDateLabel(best.date)} · ${best.source === 'meeting' ? '모임 기록' : '개인 입력'}</p>
      </div>
      <div class="field">
        <span class="label">목표기록</span>
        ${timeInputsHtml('goal', view.event.distance, target, '목표기록')}
      </div>
      <div class="row wrap">${shortcuts}</div>
      ${errorHtml(view.error)}
      <button class="button primary" type="submit">${view.goalCs === null ? '목표로 정하고 세트 보기' : '목표 바꾸기'}</button>
      ${view.goalCs === null ? '<p class="hint">아직 목표를 정하지 않아 1초 단축으로 보여줍니다.</p>' : ''}
    </form>`

  const p = view.prescription
  if (!p) {
    return `${head}<div class="page-body">
        ${picker}${form}
        <section class="card soft"><p>목표가 지금 최고기록보다 빠르지 않습니다. 이미 닿았다면 새 목표를 정해 보세요.</p></section>
      </div>`
  }

  const summary = `<section class="card hero stack-s">
      <p class="small">${formatTime(p.currentCs)} → ${formatTime(p.targetCs)}</p>
      <p class="hero-number"><span class="num">${seconds(p.gapCs)}</span><span class="unit">초</span></p>
      <p class="small">${p.percent.toFixed(1)}% 단축 · 1초씩 ${p.steps.length}단계${p.truncated ? ' (앞 5초만)' : ''}</p>
    </section>`

  const basis = `<p class="hint">25m 목표는 다이빙 이득 0.70초를 보정한 값입니다. 훈련은 벽에서 출발하므로 대회 평균보다 25m 당 ${seconds(p.diveShareCs)}초 느리게 잡습니다.</p>`

  const truncated = p.truncated
    ? `<section class="card soft"><p class="small">5초 넘는 목표는 먼저 5초를 줄인 뒤 다시 잡으세요. 기록이 바뀌면 세트도 다시 계산됩니다.</p></section>`
    : ''

  return `${head}<div class="page-body">
      ${picker}${form}${summary}${basis}
      ${p.steps.map(stepHtml).join('')}
      ${truncated}
    </div>`
}

function stepHtml(step: Step): string {
  const source =
    step.source === 'coach'
      ? '<span class="chip chip-coach">코치 처방</span>'
      : '<span class="chip chip-formula">공식 기본값</span>'
  return `<section class="card step-card">
      <div class="row baseline">
        <h2>${step.index}단계 · ${formatTime(step.fromCs)} → ${formatTime(step.toCs)}</h2>
        ${source}
      </div>
      <p class="small muted">25m 목표 <strong class="num pace">${formatTime(step.pace25Cs)}</strong></p>
      <ul class="set-lines">${step.lines.map(lineHtml).join('')}</ul>
      <p class="small"><strong>주 ${step.plan.perWeek}회 · ${step.plan.weeks}주</strong></p>
    </section>`
}

function lineHtml(view: LineView): string {
  const { line } = view
  const detail =
    view.targetCs !== null
      ? `<span class="num">@ ${formatTime(view.targetCs)}</span> · ${view.intervalCs === null ? '완전 회복' : `인터벌 ${clockLabel(view.intervalCs)}`}${line.paceOffsetCs < 0 ? ' · 목표보다 빠르게' : ''}`
      : `${EFFORT_LABEL[line.effort]} · ${line.restS === null ? '완전 회복' : `휴식 ${line.restS}초`}`
  return `<li>
      <p><strong>${esc(line.name)}</strong> <span class="num">${view.head}</span></p>
      <p class="small">${detail}</p>
      ${line.note ? `<p class="small muted">${esc(line.note)}</p>` : ''}
    </li>`
}

// ── 운영자: 코치 처방 조정 ───────────────────────────────────

export interface AdminSetsView {
  event: SwimEvent
  bracket: Bracket
  /** 폼에 채울 묶음 — 코치 처방이 있으면 그것, 없으면 공식 기본값(중급 회원 기준). */
  plan: SetPlan
  /** 코치 처방이 저장돼 있으면 그 시각. */
  overriddenAt: string | null
  /** 어느 구간을 코치가 덮어썼는지. 구간 탭에 점을 찍는다. */
  overridden: ReadonlySet<Bracket>
  saved: boolean
  error: string | null
}

/** 방식 select 의 값. "빠르게"는 저장할 때 pace + 25m 당 -0.50초로 바뀐다. */
type EffortChoice = SetEffort | 'faster'

const EFFORT_CHOICES: [EffortChoice, string][] = [
  ['pace', '목표 페이스'],
  ['faster', '목표보다 빠르게 (25m 당 0.5초)'],
  ['max', '전력'],
  ['easy', '편하게'],
  ['technique', '기술 위주'],
]

export function adminSetsHtml(view: AdminSetsView): string {
  const key = eventKey(view.event)
  const tabs = BRACKETS.map((b) => {
    const on = b === view.bracket
    const dot = view.overridden.has(b) ? ' •' : ''
    return `<a href="#/admin/sets?e=${key}&b=${b}" class="segment${on ? ' is-on' : ''}"${on ? ' aria-current="true"' : ''}>${b === 3 ? '2초+' : `${b}초째`}${dot}</a>`
  }).join('')

  const blank: SetLine = { name: '', reps: 0, distance: 25, restS: null, effort: 'pace', paceOffsetCs: 0, note: '' }
  const rows = Array.from({ length: PLAN_LINES_MAX }, (_, i) => lineFieldsHtml(i, view.plan.lines[i] ?? blank, i < view.plan.lines.length)).join('')

  const status = view.saved
    ? `<p class="form-ok" role="status">저장했습니다. 회원 세트 화면에 바로 보입니다.</p>`
    : view.overriddenAt
      ? `<p class="small"><span class="chip chip-coach">코치 처방</span> ${shortDateLabel(view.overriddenAt.slice(0, 10))} 저장</p>`
      : `<p class="small"><span class="chip chip-formula">공식 기본값</span> 아래는 중급 회원 기준 밑그림입니다. 공식은 회원 기록에 따라 반복 수가 달라지고, 저장하면 모든 회원이 같은 묶음을 받습니다.</p>`

  const reset = view.overriddenAt
    ? `<button type="button" class="button" data-action="reset-override" data-event="${key}" data-bracket="${view.bracket}">공식 기본값으로 되돌리기</button>`
    : ''

  return `${adminHeadHtml('sets', '세트 처방 조정')}
    <form id="override-form" class="page-body" novalidate>
      <input type="hidden" name="event" value="${key}" />
      <input type="hidden" name="bracket" value="${view.bracket}" />
      <div class="field">
        <label for="admin-sets-event">종목</label>
        ${eventSelect('admin-sets-event', view.event, 'admin-sets')}
      </div>
      <nav class="segmented compact" aria-label="단축 구간">${tabs}</nav>
      <p class="small muted">단축 구간 ${BRACKET_LABEL[view.bracket]} — 이 구간을 줄이는 회원이 받는 묶음입니다.</p>
      ${status}
      ${rows}
      <div class="grid-2">
        <div class="field">
          <label for="plan-per-week">주당 횟수</label>
          <input id="plan-per-week" name="perWeek" type="number" inputmode="numeric" min="1" max="7" value="${view.plan.perWeek}" />
        </div>
        <div class="field">
          <label for="plan-weeks">기간 (주)</label>
          <input id="plan-weeks" name="weeks" type="number" inputmode="numeric" min="1" max="16" value="${view.plan.weeks}" />
        </div>
      </div>
      ${errorHtml(view.error)}
      <button class="button primary" type="submit">코치 처방으로 저장</button>
      ${reset}
      <p class="hint">이름을 비운 줄은 저장하지 않습니다. 휴식을 비우면 완전 회복입니다. 목표 시간과 인터벌은 회원마다 자기 목표에서 계산됩니다.</p>
    </form>`
}

function lineFieldsHtml(i: number, line: SetLine, used: boolean): string {
  const choice: EffortChoice = line.effort === 'pace' && line.paceOffsetCs < 0 ? 'faster' : line.effort
  const effortOptions = EFFORT_CHOICES.map(
    ([value, label]) => `<option value="${value}"${value === choice ? ' selected' : ''}>${label}</option>`,
  ).join('')
  const distanceOptions = SET_DISTANCES.map(
    (d) => `<option value="${d}"${d === line.distance ? ' selected' : ''}>${d}m</option>`,
  ).join('')
  return `<fieldset class="card line-fields">
      <legend>세트 ${i + 1}${used ? '' : ' <span class="muted">(비움)</span>'}</legend>
      <div class="field">
        <label for="l${i}-name">이름</label>
        <input id="l${i}-name" name="l${i}-name" maxlength="30" value="${esc(line.name)}" placeholder="예: 레이스 페이스 25" />
      </div>
      <div class="grid-3">
        <div class="field">
          <label for="l${i}-reps">반복</label>
          <input id="l${i}-reps" name="l${i}-reps" type="number" inputmode="numeric" min="1" max="40" value="${line.reps || ''}" />
        </div>
        <div class="field">
          <label for="l${i}-distance">거리</label>
          <select id="l${i}-distance" name="l${i}-distance">${distanceOptions}</select>
        </div>
        <div class="field">
          <label for="l${i}-rest">휴식(초)</label>
          <input id="l${i}-rest" name="l${i}-rest" type="number" inputmode="numeric" min="0" max="300" value="${line.restS ?? ''}" />
        </div>
      </div>
      <div class="field">
        <label for="l${i}-effort">방식</label>
        <select id="l${i}-effort" name="l${i}-effort">${effortOptions}</select>
      </div>
      <div class="field">
        <label for="l${i}-note">메모 <span class="muted">(선택)</span></label>
        <input id="l${i}-note" name="l${i}-note" maxlength="60" value="${esc(line.note)}" />
      </div>
    </fieldset>`
}

/** 폼 값 → SetPlan. 이름이 빈 줄은 버린다. 검사는 `planProblem` 이 한다. */
export function readPlanForm(get: (name: string) => string): SetPlan {
  const lines: SetLine[] = []
  for (let i = 0; i < PLAN_LINES_MAX; i++) {
    const name = get(`l${i}-name`).trim()
    if (!name) continue
    const choice = get(`l${i}-effort`) as EffortChoice
    const rest = get(`l${i}-rest`).trim()
    lines.push({
      name,
      reps: Number(get(`l${i}-reps`)),
      distance: Number(get(`l${i}-distance`)),
      restS: rest === '' ? null : Number(rest),
      effort: choice === 'faster' ? 'pace' : Object.hasOwn(EFFORT_LABEL, choice) ? choice : 'pace',
      paceOffsetCs: choice === 'faster' ? -50 : 0,
      note: get(`l${i}-note`).trim(),
    })
  }
  return { lines, perWeek: Number(get('perWeek')), weeks: Number(get('weeks')) }
}
