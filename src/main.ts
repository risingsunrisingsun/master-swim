/**
 * 화면 배선.
 *
 * 계산은 순수 함수(ADR-0001), HTML 생성은 `view.ts` 에 있다. 여기서는 입력을 읽어
 * 프로필로 만들고, 결과를 붙이고, 저장하고, 서비스워커를 등록하는 일만 한다.
 */
import { grade } from './grading'
import { formatTime, parseTimeInput } from './pace'
import { weeklyPlan } from './plan'
import { load, save } from './storage'
import type { AgeGroup, Distance, Profile, Sex, Stroke } from './types'
import { NEEDS_INPUT_HTML, resultHtml } from './view'

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id)
  if (!element) throw new Error(`요소를 찾을 수 없습니다: #${id}`)
  return element as T
}

const inputs = {
  stroke: $<HTMLSelectElement>('stroke'),
  distance: $<HTMLSelectElement>('distance'),
  current: $<HTMLInputElement>('current'),
  target: $<HTMLInputElement>('target'),
  ageGroup: $<HTMLSelectElement>('age-group'),
  sex: $<HTMLSelectElement>('sex'),
  sessions: $<HTMLInputElement>('sessions'),
  meters: $<HTMLInputElement>('meters'),
}
const result = $<HTMLElement>('result')
const echoes = {
  current: $<HTMLElement>('current-echo'),
  target: $<HTMLElement>('target-echo'),
}
const savedLabel = $<HTMLElement>('saved')

/** 입력이 전부 유효할 때만 프로필을 만든다. 하나라도 비면 null. */
function readProfile(): Profile | null {
  const targetCs = parseTimeInput(inputs.target.value)
  const currentCs = parseTimeInput(inputs.current.value)
  const sessionsPerWeek = Number(inputs.sessions.value)
  const metersPerSession = Number(inputs.meters.value)

  if (targetCs === null || currentCs === null) return null
  if (!Number.isFinite(sessionsPerWeek) || !Number.isFinite(metersPerSession)) return null

  return {
    ageGroup: inputs.ageGroup.value as AgeGroup,
    sex: inputs.sex.value as Sex,
    goal: {
      event: {
        stroke: inputs.stroke.value as Stroke,
        distance: Number(inputs.distance.value) as Distance,
      },
      targetCs,
      currentCs,
    },
    load: { sessionsPerWeek, metersPerSession },
  }
}

/**
 * 입력한 숫자가 어떤 기록으로 읽혔는지 그 자리에서 되돌려준다.
 * 이게 없으면 `12345` 를 친 사람이 1:23.45 로 읽혔는지 확인할 방법이 없다.
 */
function renderEcho(field: 'current' | 'target'): void {
  const raw = inputs[field].value
  const parsed = parseTimeInput(raw)

  if (raw.trim() === '') {
    echoes[field].textContent = ''
    echoes[field].classList.remove('bad')
    return
  }

  echoes[field].textContent = parsed === null ? '읽을 수 없는 숫자' : `→ ${formatTime(parsed)}`
  echoes[field].classList.toggle('bad', parsed === null)
}

function render(): void {
  renderEcho('current')
  renderEcho('target')

  const profile = readProfile()
  if (!profile) {
    result.innerHTML = NEEDS_INPUT_HTML
    savedLabel.textContent = ''
    return
  }

  const grading = grade(profile.goal.currentCs, profile.goal.event, profile.sex, profile.load)
  result.innerHTML = resultHtml(profile, grading, weeklyPlan(profile, grading))
  save(profile)

  const now = new Date()
  savedLabel.textContent = `이 기기에 저장됨 · ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
}

function restore(): void {
  const { profile } = load()
  if (!profile) return

  inputs.stroke.value = profile.goal.event.stroke
  inputs.distance.value = String(profile.goal.event.distance)
  // 되살릴 때도 사람이 읽는 형식으로 넣는다. parseTimeInput 이 콜론을 그대로 받는다.
  inputs.current.value = formatTime(profile.goal.currentCs)
  inputs.target.value = formatTime(profile.goal.targetCs)
  inputs.ageGroup.value = profile.ageGroup
  inputs.sex.value = profile.sex
  inputs.sessions.value = String(profile.load.sessionsPerWeek)
  inputs.meters.value = String(profile.load.metersPerSession)
}

for (const element of Object.values(inputs)) {
  element.addEventListener('input', render)
}

// 계산은 입력할 때마다 이미 끝나 있다. 이 버튼은 폰에서 화면 아래에 있는 결과로
// 데려가는 역할만 한다 — 누를 것이 없으면 사람은 입력이 먹혔는지 알 수 없다.
$<HTMLButtonElement>('show-plan').addEventListener('click', () => {
  inputs.meters.blur() // 키보드를 내려야 결과가 화면에 들어온다
  result.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

restore()
render()

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    // GitHub Pages 는 /<repo>/ 하위에 올라가므로 경로는 반드시 상대경로로 둔다.
    void navigator.serviceWorker.register('./sw.js')
  })
}
