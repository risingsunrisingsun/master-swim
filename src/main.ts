/**
 * 화면 배선과 라우팅.
 *
 * 계산은 순수 함수(ADR-0001), HTML 생성은 `view.ts` 에 있다. 여기서는 입력을 읽고
 * 결과를 붙이고 저장한다. 라우팅은 해시로만 한다 — 정적 호스팅에는 서버 라우터가 없다.
 */
import { grade } from './grading'
import { composeTimeInput, formatTime, splitTimeInput } from './pace'
import { weekDays, weeklyPlan } from './plan'
import { pickQuote } from './quotes'
import { addLog, addRecord, load, removeRecord, saveProfile } from './storage'
import { buildQuiz, type QuizQuestion } from './terms'
import type { AgeGroup, Distance, Profile, RaceEvent, Sex, Stroke } from './types'
import {
  drylandHtml,
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
  trainingHtml,
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
}

/**
 * 칸 구성이 바뀌어도 **같은 기록을 가리키게** 다시 접는다.
 *
 * 100m→50m 이면 분을 초로 내리고(1:25.00 → 85.00), 50m→100m 이면 60초 이상을
 * 분으로 올린다. 분 칸을 그냥 지우면 1:25.00 이 25.00 이 되어 조용히 1분이 사라진다.
 */
function refoldTime(min: HTMLInputElement, sec: HTMLInputElement, secondsOnly: boolean): void {
  const cs = composeTimeInput(min.value, sec.value)
  if (cs === null) {
    // 읽을 수 없는 입력이라 보존할 값이 없다. 숨는 칸만 비운다.
    if (secondsOnly) min.value = ''
    return
  }

  const next = splitTimeInput(cs, secondsOnly)
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
  return { heightCm, weightKg }
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
  }
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
  echo.textContent = parsed === null ? '읽을 수 없는 숫자' : `→ ${formatTime(parsed)}`
  echo.classList.toggle('bad', parsed === null)
}

// ---------------------------------------------------------------------------
// 훈련 화면
// ---------------------------------------------------------------------------

function renderTraining(): void {
  renderPairEcho(inputs.currentMin, inputs.currentSec, $<HTMLElement>('current-echo'))
  renderPairEcho(inputs.targetMin, inputs.targetSec, $<HTMLElement>('target-echo'))

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
    recordSaved.textContent = '날짜와 기록을 모두 넣어주세요'
    return
  }

  addRecord({ date, event: selectedEvent(), timeCs })
  recordInputs.min.value = ''
  recordInputs.sec.value = ''
  recordSaved.textContent = '추가됨'
  renderRecords()
}

// ---------------------------------------------------------------------------
// 지상훈련
// ---------------------------------------------------------------------------

/** 지금 보고 있는 영법. 저장된 목표 종목에서 시작해 화면에서 바꿀 수 있다. */
let drylandStroke: Stroke = 'free'

function renderDryland(): void {
  screens.dryland.innerHTML = drylandHtml(drylandStroke)

  $<HTMLSelectElement>('dryland-stroke').addEventListener('change', (event) => {
    drylandStroke = (event.target as HTMLSelectElement).value as Stroke
    renderDryland()
    scrollTo({ top: 0 })
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

function renderTerms(): void {
  screens.terms.innerHTML = termsHtml()
  $<HTMLButtonElement>('quiz-start').addEventListener('click', startQuiz)
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
  '#/dryland': {
    screen: 'dryland',
    title: '지상훈련 세트',
    sub: '영법별로 뭍에서 만들 것',
    back: true,
  },
  '#/terms': {
    screen: 'terms',
    title: '수영용어',
    sub: '코치 말을 알아듣는 데 필요한 것',
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
  }

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

$<HTMLButtonElement>('show-plan').addEventListener('click', () => {
  inputs.meters.blur() // 키보드를 내려야 결과가 화면에 들어온다
  result.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
