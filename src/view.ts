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
import type { Quote } from './quotes'
import { SESSION_MET, weeklyMeters, type PlannedSession, type WeekDay } from './plan'
import type { AgeGroup, Distance, Profile, RaceEvent, RecordEntry, Sex } from './types'
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

/** 팀 훈련일정이 사는 곳. 앱은 개인 처방만 하고 일정은 카페가 갖는다(CONTEXT.md · 범위). */
export const CAFE_URL = 'https://cafe.naver.com/nineteenswim'

/**
 * 메뉴 아래 빈자리에 어록 하나.
 *
 * 사진 저작자와 라이선스를 **함께 띄운다** — CC BY 계열의 조건이고, 어록의 출처도
 * 같이 걸어 둔다. 지어낸 문장이 아니라는 걸 화면에서 확인할 수 있어야 한다(`quotes.ts`).
 */
/**
 * 사진 자리를 메우는 팀 마크.
 *
 * 자유 라이선스 사진이 없는 선수(매킨토시 · 무삼바니)와 지은이 없는 문구가 이걸 쓴다.
 * 없는 사진을 아무거나 채우지 않으면서도 카드가 비어 보이지 않게 하는 자리다.
 */
const MARK_IMG = `<img
    class="quote-photo mark"
    src="./mark.png"
    alt=""
    width="200"
    height="200"
    loading="lazy"
  />`

export function quoteHtml(quote: Quote): string {
  // 지은이 없는 문구는 카드가 다르다 — 이름도 사진도 출처도 놓을 자리가 없다.
  // 영어를 크게 띄우는 이유는 문구의 맛이 영어 어순에 있기 때문이다.
  if (quote.kind === 'saying') {
    return `<figure class="quote saying">
      ${MARK_IMG}
      <blockquote>${escapeHtml(quote.text)}</blockquote>
      <figcaption>${escapeHtml(quote.korean)}</figcaption>
    </figure>`
  }

  const avatar = quote.photo
    ? `<img
        class="quote-photo"
        src="./quotes/${escapeHtml(quote.id)}.jpg"
        alt="${escapeHtml(quote.name)}"
        width="200"
        height="200"
        loading="lazy"
      />`
    : MARK_IMG

  const credit = quote.photo
    ? ` · 사진 ${escapeHtml(quote.photo.by)}
        (<a href="${escapeHtml(quote.photo.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(quote.photo.license)}</a>)`
    : ''

  // 출처가 없으면 링크 대신 그렇게 적는다. 확인한 문장과 그렇지 않은 문장이
  // 화면에서 구별돼야 한다(ADR-0009).
  const said = quote.source
    ? `<a href="${escapeHtml(quote.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(quote.said)}</a>`
    : `${escapeHtml(quote.said)} · <span class="unverified">출처 미확인</span>`

  return `<figure class="quote">
      ${avatar}
      <blockquote>${escapeHtml(quote.text)}</blockquote>
      <figcaption>
        <strong>${escapeHtml(quote.name)}</strong>
        <span>${escapeHtml(quote.note)}</span>
      </figcaption>
      <p class="quote-source">${said}${credit}</p>
    </figure>`
}

export const HOME_HTML = `<nav class="home">
    <a class="tile" href="#/training">
      <strong>목표 기록 훈련법</strong>
      <span>목표기록에서 주간 플랜과 식단을 만듭니다</span>
    </a>
    <a class="tile" href="#/records">
      <strong>개인기록 추이</strong>
      <span>영법별 기록을 남기고 변화를 봅니다</span>
    </a>
    <a class="tile outbound" href="${CAFE_URL}" target="_blank" rel="noopener noreferrer">
      <strong>나인틴 훈련일정 확인</strong>
      <span>네이버 카페로 이동합니다</span>
      <span class="go" aria-hidden="true">↗</span>
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

/**
 * 식단은 접어 둔다.
 *
 * 하루 화면의 주인공은 그날의 세트다. 식단은 여섯 식품군 × 세 끼라 펼치면 세트를
 * 화면 밖으로 밀어낸다. 요일을 넘겨도 편 상태가 유지되도록 `open` 을 밖에서 받는다 —
 * 이 화면은 입력 한 글자마다 통째로 다시 그려진다.
 */
function dietHtml(diet: DailyDiet, open: boolean): string {
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

  return `<details class="diet" id="diet"${open ? ' open' : ''}>
      <summary>
        <span>${diet.training ? '훈련일' : '휴식일'} 식단</span>
        <span class="meters">${kcal(diet.energy.total)}</span>
      </summary>
      <p class="hint">
        기초대사량 ${kcal(diet.energy.bmr)} · 일상활동 포함 ${kcal(diet.energy.baseline)}
        ${diet.training ? ` · 수영 ${kcal(diet.energy.swim)}` : ''} · 단백질 목표 ${Math.round(diet.proteinTargetG)}g
      </p>
      <div class="meals">${rows}</div>
      <p class="hint source">
        한국인 영양소 섭취기준(KDRIs) 식사구성안의 식품군 1회 분량과 대표식품,
        기초대사량은 Mifflin-St Jeor 식을 씁니다. 질환이 있으면 전문가와 상의하세요.
      </p>
    </details>`
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
  dietOpen = false,
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
        dietOpen,
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
  dietOpen = false,
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
    ${dayHtml(profile, days[dayIndex]!, days.length, logs, dietOpen)}

    ${splitsHtml(targetCs, event.distance)}`
}

// ---------------------------------------------------------------------------
// 개인기록 추이
// ---------------------------------------------------------------------------

function standingHtml(entry: RecordEntry, sex: Sex, ageGroup?: AgeGroup): string {
  const result = standing(entry.timeCs, entry.event, sex, ageGroup)
  const next = toNextLevel(entry.timeCs, entry.event, sex)

  const headline =
    result.source === 'distribution'
      ? `국내 마스터즈 <strong>상위 ${result.topPercent}%</strong>`
      : `위치 <strong>${result.position} / 100</strong>`

  return `<div class="standing">
      <div class="bar" role="img" aria-label="상위 ${result.position}%">
        <span style="width:${result.position}%"></span>
      </div>
      <p class="standing-text">
        ${headline} · ${LEVEL_LABEL[result.level]}
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
  ageGroup?: AgeGroup,
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
    ${latest ? standingHtml(latest, sex, ageGroup) : ''}
    ${recordTableHtml(forEvent)}`
}
