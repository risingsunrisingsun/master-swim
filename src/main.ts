/**
 * 화면 배선과 라우팅.
 *
 * 계산은 순수 함수(ADR-0001), HTML 생성은 `view.ts` 에 있다. 여기서는 입력을 읽고
 * 결과를 붙이고 저장한다. 라우팅은 해시로만 한다 — 정적 호스팅에는 서버 라우터가 없다.
 */
import { grade, type Grading } from './grading'
import { composeTimeInput, formatTime, refoldTimeInput, splitTimeInput } from './pace'
import { weekDays, weeklyPlan } from './plan'
import { pickQuote } from './quotes'
import { addLog, addRecord, load, removeRecord, saveProfile } from './storage'
import { buildQuiz, type QuizQuestion } from './terms'
import type {
  AgeGroup,
  Distance,
  Level,
  Profile,
  Purpose,
  RaceEvent,
  SessionFormat,
  Sex,
  Stroke,
} from './types'
import {
  drylandHtml,
  drylandResultsHtml,
  gradeCheckHtml,
  HOME_HTML,
  NEEDS_INPUT_HTML,
  quizAnswerHtml,
  QUIZ_LENGTH,
  quizQuestionHtml,
  quizResultHtml,
  quoteHtml,
  recordsHtml,
  SPLASH_HTML,
  termsHtml,
  termsResultsHtml,
  trainingHtml,
  WIZARD_STEPS,
  wizardRailHtml,
} from './view'

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
  dryland: $<HTMLElement>('screen-dryland'),
  terms: $<HTMLElement>('screen-terms'),
}

const inputs = {
  stroke: $<HTMLSelectElement>('stroke'),
  distance: $<HTMLSelectElement>('distance'),
  currentMin: $<HTMLInputElement>('current-min'),
  currentSec: $<HTMLInputElement>('current-sec'),
  targetMin: $<HTMLInputElement>('target-min'),
  targetSec: $<HTMLInputElement>('target-sec'),
  ageGroup: $<HTMLSelectElement>('age-group'),
  sex: $<HTMLSelectElement>('sex'),
  sessions: $<HTMLInputElement>('sessions'),
  meters: $<HTMLInputElement>('meters'),
  height: $<HTMLInputElement>('height'),
  weight: $<HTMLInputElement>('weight'),
  bodyfat: $<HTMLInputElement>('bodyfat'),
}

/** 접는 판단은 `refoldTimeInput` 이 한다. 여기는 그 결과를 칸에 넣기만 한다. */
function refoldTime(min: HTMLInputElement, sec: HTMLInputElement, secondsOnly: boolean): void {
  const next = refoldTimeInput(min.value, sec.value, secondsOnly)
  min.value = next.minutes
  sec.value = next.seconds
}

/** 분·초 두 칸과 그것을 담은 줄. 거리에 따라 분 칸이 붙었다 떨어진다. */
interface TimeField {
  readonly rowId: string
  readonly min: HTMLInputElement
  readonly sec: HTMLInputElement
}

/**
 * 25·50m 는 초 칸만, 100m 는 분 칸까지. 거리를 알면 자리수도 안다.
 *
 * 훈련 화면(현재기록·목표기록)과 기록 화면이 같은 규칙을 쓴다. 두 곳에 따로 적으면
 * 한쪽만 고쳐지는 날이 온다.
 */
function applyDistanceToTimeFields(distance: number, fields: readonly TimeField[]): void {
  const secondsOnly = distance < 100
  for (const field of fields) {
    $<HTMLElement>(field.rowId).classList.toggle('sec-only', secondsOnly)
    refoldTime(field.min, field.sec, secondsOnly)
  }
}

const recordInputs = {
  stroke: $<HTMLSelectElement>('r-stroke'),
  distance: $<HTMLSelectElement>('r-distance'),
  date: $<HTMLInputElement>('r-date'),
  min: $<HTMLInputElement>('r-min'),
  sec: $<HTMLInputElement>('r-sec'),
}

const trainingTimeFields: readonly TimeField[] = [
  { rowId: 'current-row', min: inputs.currentMin, sec: inputs.currentSec },
  { rowId: 'target-row', min: inputs.targetMin, sec: inputs.targetSec },
]

const recordTimeField: readonly TimeField[] = [
  { rowId: 'r-row', min: recordInputs.min, sec: recordInputs.sec },
]

const applyTrainingDistance = (): void =>
  applyDistanceToTimeFields(Number(inputs.distance.value), trainingTimeFields)

const applyRecordDistance = (): void =>
  applyDistanceToTimeFields(Number(recordInputs.distance.value), recordTimeField)

const result = $<HTMLElement>('result')
const recordsResult = $<HTMLElement>('records-result')
const savedLabel = $<HTMLElement>('saved')
const recordSaved = $<HTMLElement>('record-saved')
const backLink = $<HTMLAnchorElement>('back')
const title = $<HTMLElement>('screen-title')
const subtitle = $<HTMLElement>('screen-sub')

/** 지금 펼쳐 보는 요일. 주간 플랜을 하루씩 넘겨 보기 위한 것. */
let dayIndex = 0

/** 지금 서 있는 마법사 단계. `WIZARD_STEPS` 의 인덱스다. */
let wizardStep = 0

/**
 * 마법사를 끝내고 결과를 보고 있는가.
 *
 * 저장된 프로필이 있으면 처음부터 `true` 다 — 다시 온 회원에게 다섯 단계를 또
 * 밟게 하면 예전 폼보다 나빠진다.
 */
let wizardDone = false

/** 회원이 등급을 옮겼으면 그 값. 계산값을 쓰면 undefined. */
let levelAdjust: Profile['levelAdjust']

/**
 * 식단을 펼쳐 뒀는지. 기본값은 접힘이다.
 *
 * 훈련 화면은 입력 한 글자마다 통째로 다시 그려지므로 `<details open>` 이 매번
 * 초기화된다. 요일을 넘길 때도 편 상태를 유지하려면 여기서 들고 있어야 한다.
 */
let dietOpen = false

// ---------------------------------------------------------------------------
// 입력 읽기
// ---------------------------------------------------------------------------

function readBody(): Profile['body'] {
  const heightCm = Number(inputs.height.value)
  const weightKg = Number(inputs.weight.value)
  if (!heightCm || !weightKg) return undefined

  // 체지방률은 아는 사람만 넣는다. 비어 있으면 없는 것으로 두고, 범위를 벗어난
  // 값은 `nutrition.ts` 가 버리고 기존 식으로 돌아간다.
  const fat = Number(inputs.bodyfat.value)
  const bodyFatPercent = inputs.bodyfat.value.trim() !== '' && Number.isFinite(fat) ? fat : undefined

  return { heightCm, weightKg, bodyFatPercent }
}

/** 라디오 묶음에서 고른 값. 아무것도 안 골랐으면 기본값. */
function readChoice<T extends string>(name: string, fallback: T): T {
  const picked = document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)
  return (picked?.value as T | undefined) ?? fallback
}

function readProfile(): Profile | null {
  const targetCs = composeTimeInput(inputs.targetMin.value, inputs.targetSec.value)
  const currentCs = composeTimeInput(inputs.currentMin.value, inputs.currentSec.value)
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
    purpose: readChoice<Purpose>('purpose', 'faster'),
    format: readChoice<SessionFormat>('format', 'pool'),
    levelAdjust,
  }
}

/**
 * 계산된 등급에 회원의 조정을 얹는다.
 *
 * 조정이 없으면 계산값 그대로다. `mismatch` 안내는 **계산값 기준으로 그대로 둔다** —
 * 두 축이 벌어져 있다는 사실은 회원이 등급을 옮겼다고 사라지지 않는다.
 */
function effectiveGrading(base: Grading, adjust: Profile['levelAdjust']): Grading {
  return adjust ? { ...base, intensity: adjust.intensity, volume: adjust.volume } : base
}

/**
 * 입력한 숫자가 어떤 기록으로 읽혔는지 그 자리에서 되돌려준다.
 * 이게 없으면 `85.00` 을 친 사람이 1:25.00 으로 읽혔는지 확인할 방법이 없다.
 */
function renderPairEcho(min: HTMLInputElement, sec: HTMLInputElement, echo: HTMLElement): void {
  if (min.value.trim() === '' && sec.value.trim() === '') {
    echo.textContent = ''
    echo.classList.remove('bad')
    return
  }

  const parsed = composeTimeInput(min.value, sec.value)
  echo.textContent = parsed === null ? '숫자를 읽을 수 없습니다' : `→ ${formatTime(parsed)}`
  echo.classList.toggle('bad', parsed === null)
}

// ---------------------------------------------------------------------------
// 훈련 화면
// ---------------------------------------------------------------------------

/** 그 단계를 채웠는가. 못 채웠으면 다음으로 못 넘어간다. */
function stepComplete(step: number): boolean {
  if (step === 0) {
    return (
      composeTimeInput(inputs.currentMin.value, inputs.currentSec.value) !== null &&
      composeTimeInput(inputs.targetMin.value, inputs.targetSec.value) !== null
    )
  }
  if (step === 1) {
    return Number(inputs.sessions.value) > 0 && Number(inputs.meters.value) > 0
  }
  return true
}

/**
 * 마법사 한 단계를 보여준다.
 *
 * 단계마다 화면을 다시 만들지 않고 **`hidden` 만 옮긴다** — 입력 요소가 계속 살아
 * 있어야 `restore()` 와 거리별 분·초 규칙이 그대로 돈다.
 */
function renderWizard(): void {
  const form = $<HTMLElement>('form')
  const replan = $<HTMLElement>('replan')

  form.hidden = false
  replan.hidden = !wizardDone

  for (const [index] of WIZARD_STEPS.entries()) {
    $<HTMLElement>(`step-${index}`).hidden = wizardDone || index !== wizardStep
  }
  $<HTMLElement>('wizard-rail').innerHTML = wizardDone ? '' : wizardRailHtml(wizardStep)
  $<HTMLElement>('wizard-nav-row').hidden = wizardDone

  if (wizardDone) return

  const prev = $<HTMLButtonElement>('step-prev')
  const next = $<HTMLButtonElement>('step-next')
  prev.hidden = wizardStep === 0
  next.disabled = !stepComplete(wizardStep)
  next.textContent = wizardStep === WIZARD_STEPS.length - 1 ? '플랜 보기' : '다음'

  // 3단계는 앞 두 단계의 값으로 계산한 등급을 보여준다.
  if (wizardStep === 2) renderGradeCheck()
}

/** 3단계 — 계산된 등급과 조정 칸. */
function renderGradeCheck(): void {
  const profile = readProfile()
  const box = $<HTMLElement>('grade-check')
  if (!profile) {
    box.innerHTML = NEEDS_INPUT_HTML
    return
  }

  const computed = grade(profile.goal.currentCs, profile.goal.event, profile.sex, profile.load)
  box.innerHTML = gradeCheckHtml(computed)

  const intensity = $<HTMLSelectElement>('adjust-intensity')
  const volume = $<HTMLSelectElement>('adjust-volume')
  if (levelAdjust) {
    intensity.value = levelAdjust.intensity
    volume.value = levelAdjust.volume
  }

  const onAdjust = (): void => {
    const picked = { intensity: intensity.value as Level, volume: volume.value as Level }
    // 계산값으로 되돌려 놓았으면 조정을 지운다 — 흔적을 남길 이유가 없다.
    levelAdjust =
      picked.intensity === computed.intensity && picked.volume === computed.volume
        ? undefined
        : picked
  }
  intensity.addEventListener('change', onAdjust)
  volume.addEventListener('change', onAdjust)
}

function renderTraining(): void {
  renderPairEcho(inputs.currentMin, inputs.currentSec, $<HTMLElement>('current-echo'))
  renderPairEcho(inputs.targetMin, inputs.targetSec, $<HTMLElement>('target-echo'))
  renderWizard()

  const profile = readProfile()
  if (!profile) {
    result.innerHTML = wizardDone ? NEEDS_INPUT_HTML : ''
    savedLabel.textContent = ''
    return
  }

  // 결과는 마법사를 끝낸 뒤에만 그린다. 고르는 중에 아래에서 플랜이 흔들리면
  // 무엇을 보고 있는지 알 수 없다.
  if (!wizardDone) {
    result.innerHTML = ''
    return
  }

  const grading = effectiveGrading(
    grade(profile.goal.currentCs, profile.goal.event, profile.sex, profile.load),
    profile.levelAdjust,
  )
  const plan = weeklyPlan(profile, grading)
  const days = weekDays(plan)

  dayIndex = Math.min(Math.max(dayIndex, 0), days.length - 1)
  result.innerHTML = trainingHtml(profile, grading, plan, days, dayIndex, load().logs, dietOpen)

  // 식단을 편 상태는 다시 그려도 살아남아야 한다. 키·체중이 없으면 이 칸이 없다.
  const diet = document.getElementById('diet') as HTMLDetailsElement | null
  diet?.addEventListener('toggle', () => {
    dietOpen = diet.open
  })

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
  savedLabel.textContent = `이 기기에 저장했습니다 · ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
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
  renderPairEcho(recordInputs.min, recordInputs.sec, $<HTMLElement>('r-echo'))

  const { profile, records } = load()
  const sex = (profile?.sex ?? inputs.sex.value) as Sex
  recordsResult.innerHTML = recordsHtml(records, selectedEvent(), sex, profile?.ageGroup)

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
  const timeCs = composeTimeInput(recordInputs.min.value, recordInputs.sec.value)
  const date = recordInputs.date.value

  if (timeCs === null || !date) {
    recordSaved.textContent = '날짜와 기록을 모두 입력해 주세요.'
    return
  }

  addRecord({ date, event: selectedEvent(), timeCs })
  recordInputs.min.value = ''
  recordInputs.sec.value = ''
  recordSaved.textContent = '추가했습니다'
  renderRecords()
}

// ---------------------------------------------------------------------------
// 지상훈련
// ---------------------------------------------------------------------------

/** 지금 보고 있는 영법. 저장된 목표 종목에서 시작해 화면에서 바꿀 수 있다. */
let drylandStroke: Stroke = 'free'

/** 지금 친 검색어. 영법을 바꿔도 지운 적이 없으면 남는다. */
let drylandQuery = ''

function renderDryland(): void {
  screens.dryland.innerHTML = drylandHtml(drylandStroke, drylandQuery)

  $<HTMLSelectElement>('dryland-stroke').addEventListener('change', (event) => {
    drylandStroke = (event.target as HTMLSelectElement).value as Stroke
    renderDryland()
    scrollTo({ top: 0 })
  })

  // 검색은 결과 영역만 갈아 끼운다. 화면을 통째로 다시 그리면 입력 칸이 새로
  // 만들어져 커서가 날아간다.
  $<HTMLInputElement>('dryland-search').addEventListener('input', (event) => {
    drylandQuery = (event.target as HTMLInputElement).value
    $<HTMLElement>('dryland-results').innerHTML = drylandResultsHtml(drylandStroke, drylandQuery)
  })
}

// ---------------------------------------------------------------------------
// 수영용어와 퀴즈
// ---------------------------------------------------------------------------

const quizDialog = $<HTMLDialogElement>('quiz')
const quizBody = $<HTMLElement>('quiz-body')

/** 지금 풀고 있는 한 판. 문제는 열 때 한 번 만들고 끝까지 같은 것을 쓴다. */
let quiz: QuizQuestion[] = []
let quizIndex = 0
let quizCorrect = 0

function showQuizQuestion(): void {
  const question = quiz[quizIndex]
  if (!question) return showQuizResult()

  quizBody.innerHTML = quizQuestionHtml(question, quizIndex, quiz.length)

  for (const button of quizBody.querySelectorAll<HTMLButtonElement>('.quiz-option')) {
    button.addEventListener('click', () => {
      const picked = Number(button.dataset.index)
      if (picked === question.answer) quizCorrect++
      showQuizAnswer(question, picked)
    })
  }
}

function showQuizAnswer(question: QuizQuestion, picked: number): void {
  const last = quizIndex === quiz.length - 1
  // 고른 보기와 정답을 그대로 둔 채 아래에 판정을 붙인다 — 무엇을 골랐는지 사라지면
  // 왜 틀렸는지 알 수 없다.
  quizBody.innerHTML = quizQuestionHtml(question, quizIndex, quiz.length) + quizAnswerHtml(question, picked, last)

  const options = quizBody.querySelectorAll<HTMLButtonElement>('.quiz-option')
  options.forEach((button, index) => {
    button.disabled = true
    if (index === question.answer) button.classList.add('correct')
    else if (index === picked) button.classList.add('wrong')
  })

  $<HTMLButtonElement>('quiz-next').addEventListener('click', () => {
    quizIndex++
    showQuizQuestion()
  })
}

function showQuizResult(): void {
  quizBody.innerHTML = quizResultHtml(quizCorrect, quiz.length)
  $<HTMLButtonElement>('quiz-again').addEventListener('click', startQuiz)
  $<HTMLButtonElement>('quiz-close').addEventListener('click', () => quizDialog.close())
}

function startQuiz(): void {
  quiz = buildQuiz(QUIZ_LENGTH)
  quizIndex = 0
  quizCorrect = 0
  showQuizQuestion()
  if (!quizDialog.open) quizDialog.showModal()
}

/** 지금 친 검색어. 퀴즈를 열었다 닫아도 남는다. */
let termsQuery = ''

function renderTerms(): void {
  screens.terms.innerHTML = termsHtml(termsQuery)
  $<HTMLButtonElement>('quiz-start').addEventListener('click', startQuiz)

  // 지상훈련과 같은 이유로 결과 영역만 갈아 끼운다.
  $<HTMLInputElement>('terms-search').addEventListener('input', (event) => {
    termsQuery = (event.target as HTMLInputElement).value
    $<HTMLElement>('terms-results').innerHTML = termsResultsHtml(termsQuery)
  })
}

// ---------------------------------------------------------------------------
// 라우팅
// ---------------------------------------------------------------------------

const ROUTES = {
  '#/home': { screen: 'home', title: '나인틴', sub: '오늘은 무엇을 해볼까요', back: false },
  '#/training': {
    screen: 'training',
    title: '목표 기록 훈련법',
    sub: '목표기록으로 주간 플랜과 식단을 만듭니다',
    back: true,
  },
  '#/records': {
    screen: 'records',
    title: '개인기록 추이',
    sub: '영법별 기록 변화와 등급 위치',
    back: true,
  },
  '#/dryland': {
    screen: 'dryland',
    title: '지상훈련 세트',
    sub: '영법별 지상 보강운동',
    back: true,
  },
  '#/terms': {
    screen: 'terms',
    title: '수영용어',
    sub: '코치의 말을 알아듣는 데 필요한 용어',
    back: true,
  },
} as const

const topbar = $<HTMLElement>('topbar')
const disclaimer = $<HTMLElement>('disclaimer')
const quote = $<HTMLElement>('screen-quote')

function route(): void {
  const match = ROUTES[location.hash as keyof typeof ROUTES]

  for (const element of Object.values(screens)) element.hidden = true

  // 해시가 없거나 모르는 값이면 시작 화면. 상단 바와 주의문도 감춰 타이틀 화면답게 둔다 —
  // 기능이 없는 화면이고, ENTER 를 누른 다음 화면부터 주의문이 계속 따라붙는다.
  if (!match) {
    screens.splash.hidden = false
    topbar.hidden = true
    disclaimer.hidden = true
    quote.hidden = true
    return
  }

  screens[match.screen].hidden = false
  topbar.hidden = false
  disclaimer.hidden = false
  // 어록은 메뉴에서만. 훈련·기록 화면은 이미 길다.
  quote.hidden = match.screen !== 'home'
  backLink.hidden = !match.back
  title.textContent = match.title
  subtitle.textContent = match.sub

  if (match.screen === 'training') renderTraining()
  else if (match.screen === 'records') renderRecords()
  else if (match.screen === 'dryland') renderDryland()
  else if (match.screen === 'terms') renderTerms()

  scrollTo({ top: 0 })
}

// ---------------------------------------------------------------------------
// 되살리기와 배선
// ---------------------------------------------------------------------------

function restore(): void {
  const { profile } = load()
  if (!profile) return

  inputs.stroke.value = profile.goal.event.stroke
  // 25m 를 목표로 저장해 둔 회원이 있을 수 있다. 그 값은 더 이상 목록에 없으므로
  // 브라우저가 비워버린다 — 50m 로 올려 받는다.
  inputs.distance.value = String(profile.goal.event.distance)
  if (inputs.distance.value === '') inputs.distance.value = '50'

  const secondsOnly = profile.goal.event.distance < 100
  const current = splitTimeInput(profile.goal.currentCs, secondsOnly)
  const target = splitTimeInput(profile.goal.targetCs, secondsOnly)
  inputs.currentMin.value = current.minutes
  inputs.currentSec.value = current.seconds
  inputs.targetMin.value = target.minutes
  inputs.targetSec.value = target.seconds

  inputs.ageGroup.value = profile.ageGroup
  inputs.sex.value = profile.sex
  inputs.sessions.value = String(profile.load.sessionsPerWeek)
  inputs.meters.value = String(profile.load.metersPerSession)

  if (profile.body) {
    inputs.height.value = String(profile.body.heightCm)
    inputs.weight.value = String(profile.body.weightKg)
    if (profile.body.bodyFatPercent !== undefined) {
      inputs.bodyfat.value = String(profile.body.bodyFatPercent)
    }
  }

  // 마법사에서 고른 것들. 예전에 저장한 프로필에는 없어 기본값이 남는다.
  for (const [name, value] of [
    ['purpose', profile.purpose],
    ['format', profile.format],
  ] as const) {
    if (!value) continue
    const radio = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)
    if (radio) radio.checked = true
  }
  levelAdjust = profile.levelAdjust

  // 이미 다 고른 회원이다. 다섯 단계를 또 밟게 하지 않는다.
  wizardDone = true

  recordInputs.stroke.value = profile.goal.event.stroke
  recordInputs.distance.value = String(profile.goal.event.distance)

  // 지상훈련 화면은 목표 종목에서 시작한다. 대부분 그걸 보러 들어온다.
  drylandStroke = profile.goal.event.stroke
}

screens.splash.innerHTML = SPLASH_HTML
screens.home.innerHTML = HOME_HTML
// 접속할 때마다 하나. 화면을 오갈 때는 바뀌지 않는다 — 읽던 문장이 사라지면 성가시다.
quote.innerHTML = quoteHtml(pickQuote())

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

// 거리를 바꾸면 분 칸이 붙거나 떨어진다. 위 리스너보다 먼저 돌아야 하므로 따로 건다.
inputs.distance.addEventListener('change', () => {
  applyTrainingDistance()
  renderTraining()
})

for (const element of Object.values(recordInputs)) {
  element.addEventListener('input', renderRecords)
}

// 기록 화면도 같은 규칙을 쓴다. 100m 면 분 칸이 나오고 25·50m 면 사라진다.
recordInputs.distance.addEventListener('change', () => {
  applyRecordDistance()
  renderRecords()
})

$<HTMLButtonElement>('step-prev').addEventListener('click', () => {
  wizardStep = Math.max(0, wizardStep - 1)
  renderTraining()
  scrollTo({ top: 0 })
})

$<HTMLButtonElement>('step-next').addEventListener('click', () => {
  if (!stepComplete(wizardStep)) return

  if (wizardStep === WIZARD_STEPS.length - 1) {
    wizardDone = true
    // 키보드를 내려야 결과가 화면에 들어온다.
    ;(document.activeElement as HTMLElement | null)?.blur()
  } else {
    wizardStep++
  }

  renderTraining()
  scrollTo({ top: 0 })
})

// 다 만든 뒤 처음부터 다시. 값은 그대로 남아 있어 고칠 것만 고치면 된다.
$<HTMLButtonElement>('show-plan').addEventListener('click', () => {
  wizardDone = false
  wizardStep = 0
  renderTraining()
  scrollTo({ top: 0 })
})
$<HTMLButtonElement>('add-record').addEventListener('click', submitRecord)

addEventListener('hashchange', route)

restore()
applyTrainingDistance()
applyRecordDistance()
recordInputs.date.value = new Date().toISOString().slice(0, 10)
route()

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    // GitHub Pages 는 /<repo>/ 하위에 올라가므로 경로는 반드시 상대경로로 둔다.
    void navigator.serviceWorker.register('./sw.js')
  })
}
