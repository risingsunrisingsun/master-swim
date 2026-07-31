/**
 * 화면 HTML 생성.
 *
 * DOM 을 만지지 않는 순수 함수만 둔다 — 브라우저 없이 테스트할 수 있어야 하고,
 * `main.ts` 는 이 결과를 붙이는 배선만 담당한다.
 */
import { standing, toNextLevel } from './benchmark'
import { EMPTY_CHART_HTML, recordChart, type ChartBand, type ChartPoint } from './chart'
import {
  type DrylandSet,
  searchDryland,
  setByMethod,
  setsFor,
  thumbnailUrl,
  videoUrl,
  type VideoLink,
} from './dryland'
import { levelBoundaries, LEVEL_ORDER, type Grading } from './grading'
import { verdict, type SetLog } from './log'
import { dailyDiet, GROUP_LABEL, REPRESENTATIVE, type DailyDiet } from './nutrition'
import { formatTime, improvementPercent, racePace25, splitTargets } from './pace'
import type { Quote } from './quotes'
import {
  CATEGORY_LABEL,
  type QuizQuestion,
  quizVerdict,
  searchTerms,
  type Term,
  type TermCategory,
  termsByCategory,
} from './terms'
import { SESSION_MET, weeklyMeters, type PlannedSession, type WeekDay } from './plan'
import type { AgeGroup, Distance, Level, Profile, RaceEvent, RecordEntry, Sex, Stroke } from './types'
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
      <span>목표기록으로 주간 플랜과 식단을 만듭니다</span>
    </a>
    <a class="tile" href="#/records">
      <strong>개인기록 추이</strong>
      <span>영법별 기록을 남기고 변화를 봅니다</span>
    </a>
    <a class="tile" href="#/dryland">
      <strong>지상훈련 세트</strong>
      <span>영법별 지상 보강운동과 참고 영상</span>
    </a>
    <a class="tile" href="#/terms">
      <strong>수영용어</strong>
      <span>코치의 말을 알아듣는 데 필요한 용어 · 퀴즈</span>
    </a>
    <a class="tile outbound" href="${CAFE_URL}" target="_blank" rel="noopener noreferrer">
      <strong>나인틴 훈련일정 확인</strong>
      <span>네이버 카페로 이동합니다</span>
      <span class="go" aria-hidden="true">↗</span>
    </a>
  </nav>`

// ---------------------------------------------------------------------------
// 지상훈련
// ---------------------------------------------------------------------------

/**
 * 영상 카드. 미리보기 그림 + 제목 + 채널명.
 *
 * **`onerror="this.remove()"`** — 링크가 죽거나 네트워크가 끊기면 그림만 스스로
 * 빠지고 제목·채널명이 남는다. 깨진 이미지 아이콘을 띄우느니 없던 것처럼 두는 편이 낫다.
 *
 * `alt` 가 비어 있는 것은 실수가 아니다. 바로 옆에 제목이 글로 있으므로 같은 말을
 * 두 번 읽어주게 된다 — 화면 낭독기에는 장식으로 알리는 편이 맞다.
 *
 * `width`·`height` 를 박아 그림이 늦게 와도 글이 밀리지 않게 한다.
 */
function videoListHtml(videos: readonly VideoLink[]): string {
  if (videos.length === 0) return ''

  const items = videos
    .map(
      (video) => `<li>
          <a class="video" href="${escapeHtml(videoUrl(video))}" target="_blank" rel="noopener noreferrer">
            <img class="video-thumb" src="${escapeHtml(thumbnailUrl(video))}"
              width="320" height="180" loading="lazy" alt="" onerror="this.remove()" />
            <span class="video-text">
              <span class="video-title">${escapeHtml(video.title)}</span>
              <span class="channel">${escapeHtml(video.channel)}</span>
            </span>
          </a>
        </li>`,
    )
    .join('')

  return `<div class="videos">
      <h4>영상</h4>
      <ul>${items}</ul>
    </div>`
}

function drylandSetHtml(set: DrylandSet): string {
  const rows = set.exercises
    .map(
      (exercise) => `<li>
          <strong>${escapeHtml(exercise.name)}</strong>
          <span class="set">${escapeHtml(exercise.prescription)}</span>
          <span class="hint">${bold(exercise.cue)}</span>
        </li>`,
    )
    .join('')

  // `why` 는 강조(**)를 쓰는 짧은 글이라 굵게만 통과시킨다.
  return `<article class="dryland">
      <h3>${escapeHtml(set.title)}</h3>
      <p class="why">${bold(set.why)}</p>
      <ul class="exercises">${rows}</ul>
      ${videoListHtml(set.videos)}
    </article>`
}

/**
 * `**굵게**` 만 HTML 로 바꾼다.
 *
 * 마크다운 전체를 지원하지 않는다 — 이 파일이 다루는 글에 필요한 것은 강조 하나뿐이고,
 * 파서를 들이면 이스케이프 구멍이 생긴다. **먼저 이스케이프한 뒤** 치환하므로
 * 본문에 꺾쇠가 들어와도 안전하다.
 */
function bold(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

/**
 * 검색 결과 영역만. 검색창은 여기 없다.
 *
 * **입력 칸과 결과를 나눈 이유**: 한 글자마다 화면 전체를 다시 그리면 입력 칸이
 * 새로 만들어져 포커스와 커서 위치가 날아간다. `main.ts` 는 이 부분만 갈아 끼운다.
 */
export function drylandResultsHtml(stroke: Stroke, query: string): string {
  if (query.trim() === '') return setsFor(stroke).map(drylandSetHtml).join('')

  const found = searchDryland(query)
  if (found.length === 0) {
    return `<p class="empty">찾는 동작이 없습니다. 영법을 골라 전체 세트를 훑어보세요.</p>`
  }

  // 검색은 영법을 무시하므로 그 사실을 밝힌다 — 고른 영법과 다른 세트가 나오면
  // 고장으로 보인다.
  return `<p class="hint">영법과 상관없이 ${found.length}개를 찾았습니다.</p>
    ${found.map(drylandSetHtml).join('')}`
}

export function drylandHtml(stroke: Stroke, query = ''): string {
  const options = (['free', 'back', 'breast', 'fly', 'im'] as const)
    .map(
      (value) =>
        `<option value="${value}"${value === stroke ? ' selected' : ''}>${STROKE_LABEL[value]}</option>`,
    )
    .join('')

  return `<div class="finder">
      <label class="search">
        찾기
        <input type="search" id="dryland-search" value="${escapeHtml(query)}"
          placeholder="어깨 · 밴드 · 코어" autocomplete="off" />
      </label>
      <label class="picker">
        영법
        <select id="dryland-stroke">${options}</select>
      </label>
    </div>

    <p class="hint">
      주간 플랜에 들어가는 지상훈련 세트는 <strong>등급에 따라 분량이 정해집니다</strong> —
      여기 적힌 세트·반복은 등급을 나누지 않은 기본값입니다.
      통증이 있으면 강화가 아니라 진료가 먼저입니다.
    </p>

    <div id="dryland-results">${drylandResultsHtml(stroke, query)}</div>

    <p class="hint source">
      영상은 <strong>실제로 살아 있는지만 확인</strong>했고 내용을 보증하지 않습니다.
      채널명을 함께 적어두었으니 보고 판단하세요. 링크는 유튜브로 나갑니다.
    </p>`
}

// ---------------------------------------------------------------------------
// 수영용어
// ---------------------------------------------------------------------------

function termHtml(term: Term): string {
  return `<li>
      <div class="term-head">
        <strong>${escapeHtml(term.term)}</strong>
        ${term.english ? `<span class="en">${escapeHtml(term.english)}</span>` : ''}
      </div>
      <p class="term-short">${bold(term.short)}</p>
      ${term.detail ? `<p class="hint">${bold(term.detail)}</p>` : ''}
    </li>`
}

/**
 * 검색 결과 영역만. `drylandResultsHtml` 과 같은 이유로 검색창과 나눠 뒀다.
 *
 * **입력이 비면 분류별 전체 목록으로 돌아간다.** 검색은 훑어보기를 대체하지 않고
 * 덧붙는 것이다 — 무엇을 찾을지 모르는 회원은 목록을 훑어야 한다.
 */
export function termsResultsHtml(query: string): string {
  if (query.trim() === '') {
    return (Object.keys(CATEGORY_LABEL) as TermCategory[])
      .map((category) => {
        const items = termsByCategory(category)
        if (items.length === 0) return ''
        return `<section class="term-group">
            <h3>${escapeHtml(CATEGORY_LABEL[category])}</h3>
            <ul class="terms">${items.map(termHtml).join('')}</ul>
          </section>`
      })
      .join('')
  }

  const found = searchTerms(query)
  if (found.length === 0) {
    return `<p class="empty">그 말은 아직 용어집에 없습니다.</p>`
  }

  // 결과는 맞은 자리(표제어 먼저) 순서라 분류로 다시 묶지 않는다 — 묶으면 그 순서가 깨진다.
  return `<p class="hint">${found.length}개를 찾았습니다.</p>
    <ul class="terms">${found.map(termHtml).join('')}</ul>`
}

export function termsHtml(query = ''): string {
  return `<div class="finder">
      <label class="search">
        찾기
        <input type="search" id="terms-search" value="${escapeHtml(query)}"
          placeholder="용어 · 영어 표기 · 뜻" autocomplete="off" />
      </label>
    </div>

    <div class="actions">
      <button type="button" id="quiz-start">퀴즈 풀기 · ${QUIZ_LENGTH}문제</button>
    </div>

    <div id="terms-results">${termsResultsHtml(query)}</div>`
}

/** 한 판에 내는 문제 수. 폰에서 한 번에 끝낼 수 있는 길이로 잡았다. */
export const QUIZ_LENGTH = 10

/** 퀴즈 한 문제. 답을 고르기 전 상태다. */
export function quizQuestionHtml(question: QuizQuestion, index: number, total: number): string {
  const options = question.options
    .map(
      (option, i) =>
        `<button type="button" class="quiz-option" data-index="${i}">${escapeHtml(option)}</button>`,
    )
    .join('')

  // 문제와 설명은 용어집의 `short`·`detail` 그대로다. 거기에 쓰인 **강조**를
  // 통과시키지 않으면 별표가 화면에 찍힌다.
  return `<p class="quiz-progress">${index + 1} / ${total}</p>
    <p class="quiz-prompt">${bold(question.prompt)}</p>
    <div class="quiz-options">${options}</div>`
}

/** 정답 공개 뒤. 맞았든 틀렸든 설명을 보여준다 — 틀린 채 넘어가면 찍기와 같다. */
export function quizAnswerHtml(question: QuizQuestion, picked: number, last: boolean): string {
  const correct = picked === question.answer
  return `<p class="quiz-verdict ${correct ? 'ok' : 'no'}">
      ${correct ? '정답' : `오답 · 답은 <strong>${escapeHtml(question.options[question.answer]!)}</strong>`}
    </p>
    <p class="hint">${bold(question.explain)}</p>
    <button type="button" id="quiz-next">${last ? '결과 보기' : '다음 문제'}</button>`
}

export function quizResultHtml(correct: number, total: number): string {
  return `<p class="quiz-score">${correct} / ${total}</p>
    <p class="hint">${escapeHtml(quizVerdict(correct, total))}</p>
    <div class="quiz-end">
      <button type="button" id="quiz-again">다시 풀기</button>
      <button type="button" id="quiz-close" class="ghost">닫기</button>
    </div>`
}

// ---------------------------------------------------------------------------
// 훈련 — 하루씩
// ---------------------------------------------------------------------------

/**
 * 방식으로 '지상훈련도 챙기기'를 고른 회원에게만 펴 보여주는 동작 목록.
 *
 * 그 선택지는 "지상훈련을 펼쳐서 보여드립니다"라고 약속한다. 지시문 한 줄(`3세트 × 15회`)
 * 만으로는 무엇을 하라는 것인지 알 수 없으므로 `dryland.ts` 의 참고 세트에서 동작 이름과
 * 요령을 가져와 붙인다. 접어서 내보내는 이유는 하루 화면의 주인공이 그날의 수영 세트이기
 * 때문이다 — 식단과 같은 이유다.
 */
function drylandDetailHtml(methodId: string): string {
  const set = setByMethod(methodId)
  if (!set) return ''

  const rows = set.exercises
    .map(
      (exercise) => `<li>
          <strong>${escapeHtml(exercise.name)}</strong>
          <span class="set">${escapeHtml(exercise.prescription)}</span>
          <span class="hint">${bold(exercise.cue)}</span>
        </li>`,
    )
    .join('')

  return `<details class="dryland-detail">
      <summary>동작 보기</summary>
      <ul class="exercises">${rows}</ul>
    </details>`
}

function sessionItemsHtml(session: PlannedSession, expandDryland = false): string {
  return session.items
    .map((item) => {
      const detail =
        expandDryland && item.method.kind === 'dryland' ? drylandDetailHtml(item.method.id) : ''

      return `<li>
          <span class="role">${ROLE_LABEL[item.role]}</span>
          <span class="item">
            <strong>${escapeHtml(item.method.name)}</strong>
            <span class="set">${escapeHtml(item.text)}</span>
            ${item.note ? `<span class="hint">${escapeHtml(item.note)}</span>` : ''}
            ${detail}
          </span>
        </li>`
    })
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
        기초대사량 ${kcal(diet.energy.bmr)} · 일상 활동까지 ${kcal(diet.energy.baseline)}
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
      키와 체중을 입력하면 식단이 계산됩니다. 이 두 값은 <strong>이 기기에만 저장되고
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
        <button type="button" id="log-save" data-method="${escapeHtml(main.method.id)}" data-planned="${planned}">${already ? '수정' : '저장'}</button>
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
        <ul>${sessionItemsHtml(session, profile.format === 'dryland')}</ul>
        ${logHtml(session, logs, today)}
      </article>`
    : `<article class="session rest">
        <h3>${day.label}요일 · 휴식</h3>
        <p class="hint">물에 들어가지 않는 날입니다. 회복이 다음 훈련의 질을 좌우합니다.</p>
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
  '<p class="hint">현재기록과 목표기록을 숫자로 입력해 주세요.</p>'

// ---------------------------------------------------------------------------
// 마법사
// ---------------------------------------------------------------------------

/** 마법사 단계 제목. 진행 표시줄에 그대로 쓴다. */
export const WIZARD_STEPS = ['종목', '훈련량', '등급', '목적', '방식'] as const

export function wizardRailHtml(current: number): string {
  return WIZARD_STEPS.map((label, index) => {
    const state = index === current ? ' class="now" aria-current="step"' : index < current ? ' class="done"' : ''
    return `<li${state}><span class="num">${index + 1}</span>${escapeHtml(label)}</li>`
  }).join('')
}

/**
 * 3단계 — 판정된 등급을 문장으로 펴서 보여준다.
 *
 * **고르는 것이 아니라 확인하는 자리다.** 등급은 기록과 훈련량에서 계산된다
 * (`grading.ts`) — 자가 선택을 받으면 기록에 비해 과한 세트가 나가 다칠 수 있다.
 *
 * 조정은 한 단계 위아래로만 열어 두고, 올릴 때는 무엇을 감수하는지 함께 적는다.
 */
export function gradeCheckHtml(grading: Grading): string {
  const same = grading.intensity === grading.volume

  const sentence = same
    ? `기록과 훈련량이 모두 <strong>${LEVEL_LABEL[grading.intensity]}</strong>입니다.`
    : `기록으로는 <strong>${LEVEL_LABEL[grading.intensity]}</strong>,
       훈련량으로는 <strong>${LEVEL_LABEL[grading.volume]}</strong>입니다.
       세트 강도는 기록에, 분량은 훈련량에 맞춥니다.`

  return `<p class="grade-sentence">${sentence}</p>
    ${gradingHtml(grading)}
    <p class="hint">
      등급은 <strong>고르는 것이 아니라 계산되는 값</strong>입니다. 앞 화면의 기록과
      훈련 횟수를 고치면 여기도 따라 바뀝니다.
    </p>
    <details class="grade-adjust">
      <summary>내 느낌과 다릅니다</summary>
      <p class="hint">
        한 단계까지 옮길 수 있습니다. <strong>올리면 세트를 완주하지 못할 수 있고</strong>,
        그 상태로 반복하면 다칩니다. 같은 세트의 완주 기록을 세 번 남기면 앱이 목표가 적절한지
        스스로 판정해 알려드리니, 그때까지는 계산된 등급으로 가시길 권합니다.
      </p>
      <div class="row">
        <label>
          세트 강도
          <select id="adjust-intensity">${levelOptions(grading.intensity)}</select>
        </label>
        <label>
          세트 분량
          <select id="adjust-volume">${levelOptions(grading.volume)}</select>
        </label>
      </div>
    </details>`
}

/** 계산된 등급을 가운데 두고 한 단계 위아래만 연다. */
function levelOptions(current: Level): string {
  const index = LEVEL_ORDER.indexOf(current)
  return LEVEL_ORDER.filter((_, i) => Math.abs(i - index) <= 1)
    .map(
      (level) =>
        `<option value="${level}"${level === current ? ' selected' : ''}>${LEVEL_LABEL[level]}${level === current ? ' (계산됨)' : ''}</option>`,
    )
    .join('')
}

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

    <h2>이번 주 <span class="hint">계획 ${meters(planned)} / 내가 적은 양 ${meters(declared)}</span></h2>
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
      : `등급 구간 위치 <strong>${result.position} / 100</strong>`

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
    : '<p class="hint">이 종목의 기록이 아직 없습니다. 아래에서 추가해 주세요.</p>'

  return `${summary}
    ${points.length >= 2 ? recordChart(points, bands) : EMPTY_CHART_HTML}
    ${latest ? standingHtml(latest, sex, ageGroup) : ''}
    ${recordTableHtml(forEvent)}`
}
