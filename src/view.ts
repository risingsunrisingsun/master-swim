/**
 * 화면 HTML 생성.
 *
 * DOM 을 만지지 않는 순수 함수만 둔다 — 브라우저 없이 테스트할 수 있어야 하고,
 * `main.ts` 는 이 결과를 붙이는 배선만 담당한다.
 */
import { standing, toNextLevel } from './benchmark'
import { EMPTY_CHART_HTML, recordChart, type ChartBand, type ChartPoint } from './chart'
import { levelBoundaries, type Grading } from './grading'
import { verdict, type SetLog } from './log'
import { dailyDiet, GROUP_LABEL, REPRESENTATIVE, type DailyDiet } from './nutrition'
import { formatTime, improvementPercent, racePace25, splitTargets } from './pace'
import { SESSION_MET, weeklyMeters, type PlannedSession, type WeekDay } from './plan'
import type { Distance, Profile, RaceEvent, RecordEntry, Sex } from './types'
import { LEVEL_LABEL, STROKE_LABEL } from './types'

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ENTITIES[char]!)
}

const ROLE_LABEL = {
  warmup: '준비',
  main: '주 세트',
  support: '보조',
  after: '마무리',
} as const

const meters = (value: number): string => `${Math.round(value).toLocaleString('ko-KR')}m`
const kcal = (value: number): string => `${Math.round(value).toLocaleString('ko-KR')}kcal`

// ---------------------------------------------------------------------------
// 시작 화면과 메뉴
// ---------------------------------------------------------------------------

/** 게임 타이틀처럼 로고 한 장과 ENTER 하나만 둔다. */
export const SPLASH_HTML = `<div class="splash">
    <img src="./logo.png" alt="나인틴 수영팀" width="558" height="408" />
    <p class="tagline">마스터즈 수영 훈련 도구</p>
    <button type="button" id="enter" class="enter">ENTER</button>
    <p class="enter-hint">눌러서 시작하세요</p>
  </div>`

export const HOME_HTML = `<nav class="home">
    <a class="tile" href="#/training">
      <strong>목표 기록 훈련법</strong>
      <span>목표기록에서 주간 플랜과 식단을 만듭니다</span>
    </a>
    <a class="tile" href="#/records">
      <strong>개인기록 추이</strong>
      <span>영법별 기록을 남기고 변화를 봅니다</span>
    </a>
  </nav>`

// ---------------------------------------------------------------------------
// 훈련 — 하루씩
// ---------------------------------------------------------------------------

function sessionItemsHtml(session: PlannedSession): string {
  return session.items
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
}

function dietHtml(diet: DailyDiet): string {
  const rows = diet.meals
    .map((meal) => {
      const items = meal.items
        .map(
          (item) =>
            `<li><span>${GROUP_LABEL[item.group]}</span><b>${item.count}회</b>
             <span class="hint">${escapeHtml(REPRESENTATIVE[item.group].slice(0, 3).join(' · '))}</span></li>`,
        )
        .join('')
      return `<div class="meal">
          <h4>${meal.name}</h4>
          <ul>${items}</ul>
          ${meal.hint ? `<p class="hint">${escapeHtml(meal.hint)}</p>` : ''}
        </div>`
    })
    .join('')

  return `<section class="diet">
      <h3>${diet.training ? '훈련일' : '휴식일'} 식단 <span class="meters">${kcal(diet.energy.total)}</span></h3>
      <p class="hint">
        기초대사량 ${kcal(diet.energy.bmr)} · 일상활동 포함 ${kcal(diet.energy.baseline)}
        ${diet.training ? ` · 수영 ${kcal(diet.energy.swim)}` : ''} · 단백질 목표 ${Math.round(diet.proteinTargetG)}g
      </p>
      <div class="meals">${rows}</div>
      <p class="hint source">
        한국인 영양소 섭취기준(KDRIs) 식사구성안의 식품군 1회 분량과 대표식품,
        기초대사량은 Mifflin-St Jeor 식을 씁니다. 질환이 있으면 전문가와 상의하세요.
      </p>
    </section>`
}

export const NEEDS_BODY_HTML = `<section class="diet locked">
    <h3>식단</h3>
    <p class="hint">
      키와 체중을 넣으면 식단이 계산됩니다. 이 두 값은 <strong>이 기기에만 저장되고
      서버로 전송되지 않습니다</strong> — 코치도 팀원도 볼 수 없습니다.
    </p>
  </section>`

/**
 * 주 세트의 완주 개수를 받는 칸과 목표 판정.
 *
 * 처방만 하고 결과를 받지 않으면 목표기록을 검증할 수단이 없다 — USRPT 는
 * 실패 지점을 측정값으로 쓰는 방식이다(ADR-0003, ADR-0007).
 */
function logHtml(session: PlannedSession, logs: readonly SetLog[], today: string): string {
  const main = session.items.find((item) => item.role === 'main')
  if (!main || main.method.kind !== 'pool') return ''

  // 계획에 실제로 쓰인 반복 수는 지시문 앞머리("20 × 25m …")에 이미 들어 있다.
  // 두 축 등급을 합쳐 만든 값이라 카탈로그를 다시 뒤지는 것보다 이쪽이 정확하다.
  const planned = Number(/^(\d+)\s*×/.exec(main.text)?.[1] ?? 0)
  if (planned <= 0) return ''

  const result = verdict(logs, main.method.id)
  const already = logs.find((log) => log.date === today && log.methodId === main.method.id)

  return `<div class="log">
      <h4>${escapeHtml(main.method.name)} 완주 기록</h4>
      <div class="log-row">
        <label>
          계획 ${planned}개 중 페이스를 지킨 개수
          <input
            type="number"
            id="log-reps"
            min="0"
            max="${planned}"
            step="1"
            inputmode="numeric"
            value="${already ? already.completedReps : ''}"
            placeholder="0"
          />
        </label>
        <button type="button" id="log-save" data-method="${escapeHtml(main.method.id)}" data-planned="${planned}">${already ? '수정' : '기록'}</button>
      </div>
      <p class="verdict ${result.kind === 'too-hard' ? 'too-hard' : result.kind === 'ready' ? 'ready' : ''}">
        ${escapeHtml(result.message)}
      </p>
    </div>`
}

export function dayHtml(
  profile: Profile,
  day: WeekDay,
  dayCount: number,
  logs: readonly SetLog[] = [],
  today = new Date().toISOString().slice(0, 10),
): string {
  const session = day.session

  const training = session
    ? `<article class="session">
        <h3>${day.label}요일 · ${escapeHtml(session.title)} <span class="meters">${meters(session.meters)}</span></h3>
        <ul>${sessionItemsHtml(session)}</ul>
        ${logHtml(session, logs, today)}
      </article>`
    : `<article class="session rest">
        <h3>${day.label}요일 · 휴식</h3>
        <p class="hint">물에 들어가지 않는 날입니다. 회복이 다음 세션의 질을 정합니다.</p>
      </article>`

  const diet = profile.body
    ? dietHtml(
        dailyDiet(profile.body, profile.ageGroup, profile.sex, {
          training: session !== null,
          meters: session?.meters ?? 0,
          met: session ? SESSION_MET[session.focus] : 0,
        }),
      )
    : NEEDS_BODY_HTML

  return `<div class="pager">
      <button type="button" id="day-prev" aria-label="이전 날">‹</button>
      <span class="pager-label">${day.index + 1} / ${dayCount}</span>
      <button type="button" id="day-next" aria-label="다음 날">›</button>
    </div>
    ${training}
    ${diet}`
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
  '<p class="hint">현재기록과 목표기록을 숫자로 넣어주세요.</p>'

/** 훈련 화면 전체. `day` 는 지금 펼쳐 볼 요일이다. */
export function trainingHtml(
  profile: Profile,
  grading: Grading,
  plan: readonly PlannedSession[],
  days: readonly WeekDay[],
  dayIndex: number,
  logs: readonly SetLog[] = [],
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

    <h2>이번 주 <span class="hint">계획 ${meters(planned)} / 입력 ${meters(declared)}</span></h2>
    ${dayHtml(profile, days[dayIndex]!, days.length, logs)}

    ${splitsHtml(targetCs, event.distance)}`
}

// ---------------------------------------------------------------------------
// 개인기록 추이
// ---------------------------------------------------------------------------

function standingHtml(entry: RecordEntry, sex: Sex): string {
  const result = standing(entry.timeCs, entry.event, sex)
  const next = toNextLevel(entry.timeCs, entry.event, sex)

  return `<div class="standing">
      <div class="bar" role="img" aria-label="위치 ${result.position}점">
        <span style="width:${result.position}%"></span>
      </div>
      <p class="standing-text">
        <strong>${LEVEL_LABEL[result.level]}</strong> · 위치 ${result.position} / 100
        ${next ? ` · ${LEVEL_LABEL[next.level]}까지 ${formatTime(next.gapCs)}` : ' · 최상급'}
      </p>
      <p class="hint warn">${escapeHtml(result.basis)}</p>
    </div>`
}

function recordTableHtml(entries: readonly RecordEntry[]): string {
  if (entries.length === 0) return ''

  const rows = entries
    .map((entry, index) => {
      const previous = entries[index - 1]
      const delta = previous ? entry.timeCs - previous.timeCs : null
      const deltaText =
        delta === null ? '' : delta === 0 ? '±0' : `${delta < 0 ? '−' : '+'}${formatTime(Math.abs(delta))}`

      return `<tr>
          <td>${entry.date}</td>
          <td>${formatTime(entry.timeCs)}</td>
          <td class="${delta !== null && delta < 0 ? 'better' : ''}">${deltaText}</td>
          <td><button type="button" class="link" data-remove="${index}">삭제</button></td>
        </tr>`
    })
    .join('')

  return `<table class="records">
      <thead><tr><th>날짜</th><th>기록</th><th>변화</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
}

export function recordsHtml(
  entries: readonly RecordEntry[],
  event: RaceEvent,
  sex: Sex,
): string {
  const forEvent = entries.filter(
    (entry) => entry.event.stroke === event.stroke && entry.event.distance === event.distance,
  )

  const points: ChartPoint[] = forEvent.map((entry) => ({ date: entry.date, timeCs: entry.timeCs }))

  const bands: ChartBand[] = levelBoundaries(event, sex)
    .filter((boundary) => boundary.ceilingCs !== null)
    .map((boundary) => ({ ceilingCs: boundary.ceilingCs!, label: LEVEL_LABEL[boundary.level] }))

  const latest = forEvent.at(-1)
  const best = forEvent.reduce<RecordEntry | null>(
    (a, b) => (a === null || b.timeCs < a.timeCs ? b : a),
    null,
  )

  const summary = best
    ? `<div class="pace">
        <span class="pace-label">${STROKE_LABEL[event.stroke]} ${event.distance}m 최고기록</span>
        <strong class="pace-value">${formatTime(best.timeCs)}</strong>
        <span class="hint">${best.date} · 기록 ${forEvent.length}건</span>
      </div>`
    : '<p class="hint">이 종목의 기록이 아직 없습니다. 아래에서 추가하세요.</p>'

  return `${summary}
    ${points.length >= 2 ? recordChart(points, bands) : EMPTY_CHART_HTML}
    ${latest ? standingHtml(latest, sex) : ''}
    ${recordTableHtml(forEvent)}`
}
