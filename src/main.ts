/**
 * 화면 배선.
 *
 * 계산은 순수 함수(ADR-0001), HTML 생성은 `view.ts` 에 있다. 여기서는 입력을 읽어
 * 프로필로 만들고, 결과를 붙이고, 저장하고, 서비스워커를 등록하는 일만 한다.
 */
import { grade } from './grading'
import { formatTime, parseTime } from './pace'
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

/** 입력이 전부 유효할 때만 프로필을 만든다. 하나라도 비면 null. */
function readProfile(): Profile | null {
  const targetCs = parseTime(inputs.target.value)
  const currentCs = parseTime(inputs.current.value)
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

function render(): void {
  const profile = readProfile()
  if (!profile) {
    result.innerHTML = NEEDS_INPUT_HTML
    return
  }

  const grading = grade(profile.goal.currentCs, profile.goal.event, profile.sex, profile.load)
  result.innerHTML = resultHtml(profile, grading, weeklyPlan(profile, grading))
  save(profile)
}

function restore(): void {
  const { profile } = load()
  if (!profile) return

  inputs.stroke.value = profile.goal.event.stroke
  inputs.distance.value = String(profile.goal.event.distance)
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

restore()
render()

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    // GitHub Pages 는 /<repo>/ 하위에 올라가므로 경로는 반드시 상대경로로 둔다.
    void navigator.serviceWorker.register('./sw.js')
  })
}
