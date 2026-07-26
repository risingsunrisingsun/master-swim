/**
 * 화면 배선과 라우팅.
 *
 * 계산은 순수 함수(ADR-0001), HTML 생성은 `view.ts` 에 있다. 여기서는 입력을 읽고
 * 결과를 붙이고 저장한다. 라우팅은 해시로만 한다 — 정적 호스팅에는 서버 라우터가 없다.
 */
import { grade } from './grading'
import { formatTime, parseTimeInput } from './pace'
import { weekDays, weeklyPlan } from './plan'
import { addLog, addRecord, load, removeRecord, saveProfile } from './storage'
import type { AgeGroup, Distance, Profile, RaceEvent, Sex, Stroke } from './types'
import { HOME_HTML, NEEDS_INPUT_HTML, recordsHtml, SPLASH_HTML, trainingHtml } from './view'

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id)
  if (!element) throw new Error(`요소를 찾을 수 없습니다: #${id}`)
  return element as T
}

const screens = {
  splash: $<HTMLElement>('screen-splash'),
  home: $<HTMLElement>('screen-home'),
  training: $<HTMLElement>('screen-training'),
  records: $<HTMLElement>('screen-records'),
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
  height: $<HTMLInputElement>('height'),
  weight: $<HTMLInputElement>('weight'),
}

const recordInputs = {
  stroke: $<HTMLSelectElement>('r-stroke'),
  distance: $<HTMLSelectElement>('r-distance'),
  date: $<HTMLInputElement>('r-date'),
  time: $<HTMLInputElement>('r-time'),
}

const result = $<HTMLElement>('result')
const recordsResult = $<HTMLElement>('records-result')
const savedLabel = $<HTMLElement>('saved')
const recordSaved = $<HTMLElement>('record-saved')
const backLink = $<HTMLAnchorElement>('back')
const title = $<HTMLElement>('screen-title')
const subtitle = $<HTMLElement>('screen-sub')

/** 지금 펼쳐 보는 요일. 주간 플랜을 하루씩 넘겨 보기 위한 것. */
let dayIndex = 0

// ---------------------------------------------------------------------------
// 입력 읽기
// ---------------------------------------------------------------------------

function readBody(): Profile['body'] {
  const heightCm = Number(inputs.height.value)
  const weightKg = Number(inputs.weight.value)
  if (!heightCm || !weightKg) return undefined
  return { heightCm, weightKg }
}

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
    body: readBody(),
  }
}

/**
 * 입력한 숫자가 어떤 기록으로 읽혔는지 그 자리에서 되돌려준다.
 * 이게 없으면 `12345` 를 친 사람이 1:23.45 로 읽혔는지 확인할 방법이 없다.
 */
function renderEcho(input: HTMLInputElement, echo: HTMLElement): void {
  const raw = input.value
  if (raw.trim() === '') {
    echo.textContent = ''
    echo.classList.remove('bad')
    return
  }

  const parsed = parseTimeInput(raw)
  echo.textContent = parsed === null ? '읽을 수 없는 숫자' : `→ ${formatTime(parsed)}`
  echo.classList.toggle('bad', parsed === null)
}

// ---------------------------------------------------------------------------
// 훈련 화면
// ---------------------------------------------------------------------------

function renderTraining(): void {
  renderEcho(inputs.current, $<HTMLElement>('current-echo'))
  renderEcho(inputs.target, $<HTMLElement>('target-echo'))

  const profile = readProfile()
  if (!profile) {
    result.innerHTML = NEEDS_INPUT_HTML
    savedLabel.textContent = ''
    return
  }

  const grading = grade(profile.goal.currentCs, profile.goal.event, profile.sex, profile.load)
  const plan = weeklyPlan(profile, grading)
  const days = weekDays(plan)

  dayIndex = Math.min(Math.max(dayIndex, 0), days.length - 1)
  result.innerHTML = trainingHtml(profile, grading, plan, days, dayIndex, load().logs)

  $<HTMLButtonElement>('day-prev').addEventListener('click', () => {
    dayIndex = (dayIndex - 1 + days.length) % days.length
    renderTraining()
  })
  $<HTMLButtonElement>('day-next').addEventListener('click', () => {
    dayIndex = (dayIndex + 1) % days.length
    renderTraining()
  })

  // 완주 기록은 훈련일에만 나온다. 없는 날은 조용히 넘어간다.
  const logSave = document.getElementById('log-save') as HTMLButtonElement | null
  logSave?.addEventListener('click', () => {
    const field = $<HTMLInputElement>('log-reps')
    const completedReps = Number(field.value)
    const planned = Number(logSave.dataset.planned)
    const methodId = logSave.dataset.method

    if (!methodId || !Number.isFinite(completedReps) || field.value.trim() === '') return

    addLog({
      date: new Date().toISOString().slice(0, 10),
      methodId,
      plannedReps: planned,
      completedReps: Math.max(0, Math.min(completedReps, planned)),
    })
    renderTraining()
  })

  saveProfile(profile)

  const now = new Date()
  savedLabel.textContent = `이 기기에 저장됨 · ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// 기록 화면
// ---------------------------------------------------------------------------

function selectedEvent(): RaceEvent {
  return {
    stroke: recordInputs.stroke.value as Stroke,
    distance: Number(recordInputs.distance.value) as Distance,
  }
}

function renderRecords(): void {
  renderEcho(recordInputs.time, $<HTMLElement>('r-echo'))

  const { profile, records } = load()
  const sex = (profile?.sex ?? inputs.sex.value) as Sex
  recordsResult.innerHTML = recordsHtml(records, selectedEvent(), sex)

  for (const button of recordsResult.querySelectorAll<HTMLButtonElement>('[data-remove]')) {
    button.addEventListener('click', () => {
      // 표는 선택한 종목만 보여주므로, 전체 목록에서의 위치를 다시 찾아야 한다.
      const event = selectedEvent()
      const filtered = records.filter(
        (entry) => entry.event.stroke === event.stroke && entry.event.distance === event.distance,
      )
      const target = filtered[Number(button.dataset.remove)]
      const index = records.indexOf(target!)
      if (index >= 0) removeRecord(index)
      renderRecords()
    })
  }
}

function submitRecord(): void {
  const timeCs = parseTimeInput(recordInputs.time.value)
  const date = recordInputs.date.value

  if (timeCs === null || !date) {
    recordSaved.textContent = '날짜와 기록을 모두 넣어주세요'
    return
  }

  addRecord({ date, event: selectedEvent(), timeCs })
  recordInputs.time.value = ''
  recordSaved.textContent = '추가됨'
  renderRecords()
}

// ---------------------------------------------------------------------------
// 라우팅
// ---------------------------------------------------------------------------

const ROUTES = {
  '#/home': { screen: 'home', title: '나인틴', sub: '무엇을 하시겠습니까', back: false },
  '#/training': {
    screen: 'training',
    title: '목표 기록 훈련법',
    sub: '목표 페이스에서 주간 플랜과 식단을 만듭니다',
    back: true,
  },
  '#/records': {
    screen: 'records',
    title: '개인기록 추이',
    sub: '영법별 기록 변화와 등급 위치',
    back: true,
  },
} as const

const topbar = $<HTMLElement>('topbar')

function route(): void {
  const match = ROUTES[location.hash as keyof typeof ROUTES]

  for (const element of Object.values(screens)) element.hidden = true

  // 해시가 없거나 모르는 값이면 시작 화면. 상단 바도 감춰 타이틀 화면답게 둔다.
  if (!match) {
    screens.splash.hidden = false
    topbar.hidden = true
    return
  }

  screens[match.screen].hidden = false
  topbar.hidden = false
  backLink.hidden = !match.back
  title.textContent = match.title
  subtitle.textContent = match.sub

  if (match.screen === 'training') renderTraining()
  else if (match.screen === 'records') renderRecords()

  scrollTo({ top: 0 })
}

// ---------------------------------------------------------------------------
// 되살리기와 배선
// ---------------------------------------------------------------------------

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

  if (profile.body) {
    inputs.height.value = String(profile.body.heightCm)
    inputs.weight.value = String(profile.body.weightKg)
  }

  recordInputs.stroke.value = profile.goal.event.stroke
  recordInputs.distance.value = String(profile.goal.event.distance)
}

screens.splash.innerHTML = SPLASH_HTML
screens.home.innerHTML = HOME_HTML

const goHome = (): void => {
  location.hash = '#/home'
}

$<HTMLButtonElement>('enter').addEventListener('click', goHome)

// 게임 타이틀처럼 Enter 키로도 들어간다. 시작 화면에 있을 때만 받는다.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !screens.splash.hidden) goHome()
})

for (const element of Object.values(inputs)) {
  element.addEventListener('input', renderTraining)
}
for (const element of Object.values(recordInputs)) {
  element.addEventListener('input', renderRecords)
}

$<HTMLButtonElement>('show-plan').addEventListener('click', () => {
  inputs.meters.blur() // 키보드를 내려야 결과가 화면에 들어온다
  result.scrollIntoView({ behavior: 'smooth', block: 'start' })
})
$<HTMLButtonElement>('add-record').addEventListener('click', submitRecord)

addEventListener('hashchange', route)

restore()
recordInputs.date.value = new Date().toISOString().slice(0, 10)
route()

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    // GitHub Pages 는 /<repo>/ 하위에 올라가므로 경로는 반드시 상대경로로 둔다.
    void navigator.serviceWorker.register('./sw.js')
  })
}
