/**
 * 대회 참가 신청 화면 — 회원의 신청, 운영자의 대회 열기 · 신청 취합 · 단체전 명단.
 *
 * 사람이 넣은 글자(대회 이름 · 장소 · 안내 · 메모 · 회원 이름)는 전부 `esc` 를 거친다.
 * 단체전 명단은 다른 회원의 이름과 기록이 함께 나오므로 운영자 화면에만 있다(PRD-0001 §2).
 */
import { isOpen, sortEvents, tallyEntries } from '../core/competitions'
import { shortDateLabel } from '../core/dates'
import {
  MEDLEY_ORDER,
  RELAY_GENDER_LABEL,
  RELAY_KIND_LABEL,
  type RelayGender,
  type RelayKind,
  type RelayOptions,
  type RelayResult,
  type RelaySwimmer,
  type RelayTeam,
} from '../core/relay'
import { eventKey, eventLabel, formatTime, sameEvent } from '../core/time'
import {
  type Competition,
  COMPETITION_NAME_MAX,
  type CompetitionEntry,
  MAX_EVENTS_LIMIT,
  type Member,
  RECORD_EVENTS,
  STROKE_LABEL,
  type SwimEvent,
} from '../core/types'
import { adminHeadHtml, errorHtml, esc } from './views'

const seconds = (cs: number): string => (cs / 100).toFixed(2)

function competitionFacts(c: Competition): string {
  return [shortDateLabel(c.date), c.place ? esc(c.place) : '', `${shortDateLabel(c.deadline)}까지 신청`].filter(Boolean).join(' · ')
}

// ── 회원: 신청 ───────────────────────────────────────────────

export interface CompetitionView {
  competition: Competition
  entry: CompetitionEntry | null
  today: string
  saved: boolean
  error: string | null
}

export function competitionHtml(view: CompetitionView): string {
  const { competition: c, entry } = view
  const open = isOpen(c, view.today)
  const head = `<header class="page-head row">
      <h1>대회 신청</h1>
      <a class="small" href="#/home">홈으로</a>
    </header>`
  const info = `<section class="card stack-s">
      <p class="card-title">${esc(c.name)}</p>
      <p class="small muted">${competitionFacts(c)}</p>
      ${c.note ? `<p class="small">${esc(c.note)}</p>` : ''}
    </section>`

  if (!open) {
    const mine = entry
      ? [...sortEvents(entry.events).map(eventLabel), entry.relay ? '단체전 가능' : ''].filter(Boolean).join(' · ')
      : '신청하지 않았습니다.'
    return `${head}<div class="page-body">${info}
        <section class="card stack-s">
          <h2>내 신청 <span class="chip chip-absent">마감</span></h2>
          <p>${esc(mine)}</p>
          ${entry?.note ? `<p class="small muted">${esc(entry.note)}</p>` : ''}
          <p class="small muted">마감 뒤에 바꿔야 하면 운영진에게 말해 주세요.</p>
        </section>
      </div>`
  }

  const chosen = (e: SwimEvent) => entry?.events.some((x) => sameEvent(x, e)) ?? false
  const boxes = sortEvents(c.events)
    .map(
      (e) => `<label class="check-row">
          <input type="checkbox" name="event" value="${eventKey(e)}"${chosen(e) ? ' checked' : ''} />
          <span>${eventLabel(e)}</span>
        </label>`,
    )
    .join('')

  return `${head}<div class="page-body">
      ${info}
      <form id="entry-form" class="card stack" novalidate>
        <input type="hidden" name="competition" value="${esc(c.id)}" />
        <div class="row baseline">
          <h2>개인 종목</h2>
          <span class="small muted">${c.maxEvents}개까지</span>
        </div>
        ${c.events.length ? `<div class="check-list">${boxes}</div>` : '<p class="small muted">이 대회는 개인 종목 신청을 받지 않습니다.</p>'}
        ${
          c.relays
            ? `<label class="check-row boxed">
                <input type="checkbox" name="relay" value="yes"${entry?.relay ? ' checked' : ''} />
                <span>단체전(계영 · 혼계영)에 나갈 수 있어요</span>
              </label>
              <p class="hint">운영진이 기록을 보고 단체전 명단을 짭니다. 영법은 운영진이 정합니다.</p>`
            : ''
        }
        <div class="field">
          <label for="entry-note">메모 <span class="muted">(선택)</span></label>
          <input id="entry-note" name="note" maxlength="100" value="${esc(entry?.note ?? '')}" placeholder="예: 오전만 가능" />
        </div>
        ${view.saved ? '<p class="form-ok" role="status">저장했습니다. 마감 전까지 고칠 수 있어요.</p>' : ''}
        ${errorHtml(view.error)}
        <button class="button primary" type="submit">${entry ? '신청 고치기' : '신청하기'}</button>
        ${entry ? `<button type="button" class="button danger-quiet" data-action="delete-entry" data-id="${esc(c.id)}">신청 취소</button>` : ''}
        <p class="hint">${shortDateLabel(c.deadline)}까지 고치거나 취소할 수 있습니다. 다른 회원의 신청은 보이지 않습니다.</p>
      </form>
    </div>`
}

// ── 운영자: 대회 목록 · 열기 ─────────────────────────────────

export interface AdminCompetitionsView {
  today: string
  /** 날짜가 늦은 것이 위. */
  competitions: { competition: Competition; entries: number }[]
  notice: string | null
  error: string | null
}

/** 대회 칸. 열기와 고치기가 같이 쓴다. */
function competitionFieldsHtml(c: Competition | null, today: string): string {
  const defaults: SwimEvent[] = [
    { stroke: 'free', distance: 50 },
    { stroke: 'back', distance: 50 },
    { stroke: 'breast', distance: 50 },
    { stroke: 'fly', distance: 50 },
  ]
  const events = c?.events ?? defaults
  const boxes = RECORD_EVENTS.map((e) => {
    const on = events.some((x) => sameEvent(x, e))
    return `<label class="event-check"><input type="checkbox" name="events" value="${eventKey(e)}"${on ? ' checked' : ''} />${eventLabel(e)}</label>`
  }).join('')
  return `<div class="field">
      <label for="comp-name">대회 이름 <span class="muted">(${COMPETITION_NAME_MAX}자까지)</span></label>
      <input id="comp-name" name="name" required maxlength="${COMPETITION_NAME_MAX}" value="${esc(c?.name ?? '')}" placeholder="예: 서울시장배 마스터즈" />
    </div>
    <div class="grid-2">
      <div class="field">
        <label for="comp-date">대회 날</label>
        <input id="comp-date" name="date" type="date" required value="${c?.date ?? today}" />
      </div>
      <div class="field">
        <label for="comp-deadline">신청 마감</label>
        <input id="comp-deadline" name="deadline" type="date" required value="${c?.deadline ?? today}" />
      </div>
    </div>
    <div class="field">
      <label for="comp-place">장소 <span class="muted">(선택)</span></label>
      <input id="comp-place" name="place" maxlength="40" value="${esc(c?.place ?? '')}" />
    </div>
    <fieldset class="field event-checks">
      <legend class="label">받을 개인 종목</legend>
      <div class="event-check-grid">${boxes}</div>
    </fieldset>
    <div class="grid-2">
      <div class="field">
        <label for="comp-max">한 사람당 종목 수</label>
        <input id="comp-max" name="maxEvents" type="number" inputmode="numeric" min="1" max="${MAX_EVENTS_LIMIT}" value="${c?.maxEvents ?? 2}" />
      </div>
      <label class="check-row boxed align-end">
        <input type="checkbox" name="relays" value="yes"${(c?.relays ?? true) ? ' checked' : ''} />
        <span>단체전 의사도 받기</span>
      </label>
    </div>
    <div class="field">
      <label for="comp-note">회원에게 보일 안내 <span class="muted">(선택 · 200자)</span></label>
      <input id="comp-note" name="note" maxlength="200" value="${esc(c?.note ?? '')}" placeholder="예: 참가비는 카페 공지 참고" />
    </div>`
}

export function adminCompetitionsHtml(view: AdminCompetitionsView): string {
  const rows = view.competitions
    .map(({ competition: c, entries }) => {
      const state = c.date < view.today ? '지남' : isOpen(c, view.today) ? '신청 중' : '마감'
      const chip = c.date < view.today ? 'cancelled' : isOpen(c, view.today) ? 'going' : 'absent'
      return `<li>
          <a class="list-row row-link" href="#/admin/competition?id=${encodeURIComponent(c.id)}">
            <span class="list-date">${shortDateLabel(c.date)}</span>
            <span class="list-note"><strong class="ink">${esc(c.name)}</strong><br />신청 ${entries}명 · ${shortDateLabel(c.deadline)} 마감</span>
            <span class="chip chip-${chip}">${state}</span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
        </li>`
    })
    .join('')

  return `${adminHeadHtml('competitions', '대회 신청')}
    <div class="page-body">
      ${view.notice ? `<p class="form-ok" role="status">${esc(view.notice)}</p>` : ''}
      ${errorHtml(view.error)}
      <section class="card list-card">
        <ul class="list">${rows || '<li class="list-row muted">연 대회가 없습니다. 아래에서 여세요.</li>'}</ul>
      </section>
      <details class="card"${view.competitions.length === 0 ? ' open' : ''}>
        <summary><h2>대회 열기</h2></summary>
        <form id="competition-form" class="stack" novalidate>
          ${competitionFieldsHtml(null, view.today)}
          <button class="button primary" type="submit">대회 열기</button>
          <p class="hint">열면 회원 홈에 신청 카드가 뜹니다. 회원은 자기 신청만 보고, 마감일까지 고칠 수 있습니다.</p>
        </form>
      </details>
      <a class="card row-link plain" href="#/admin/relay">
        <span><strong>단체전 명단 짜기</strong><br /><span class="small muted">대회 없이 회원 전원의 50m 기록으로</span></span>
        <span class="chevron" aria-hidden="true">›</span>
      </a>
    </div>`
}

// ── 운영자: 대회 한 개 ───────────────────────────────────────

export interface AdminCompetitionView {
  competition: Competition
  entries: CompetitionEntry[]
  members: Member[]
  today: string
  saved: boolean
  error: string | null
}

export function adminCompetitionHtml(view: AdminCompetitionView): string {
  const c = view.competition
  const tally = tallyEntries(c, view.entries, view.members)
  const name = (id: string) => view.members.find((m) => m.id === id)?.displayName ?? '(알 수 없음)'

  const byEvent = tally.events
    .map(
      (t) => `<li class="tally-row">
          <span class="tally-event">${eventLabel(t.event)} <span class="num">${t.names.length}</span></span>
          <span class="small muted">${t.names.length ? t.names.map(esc).join(', ') : '없음'}</span>
        </li>`,
    )
    .join('')
  const relayRow = c.relays
    ? `<li class="tally-row">
        <span class="tally-event">단체전 가능 <span class="num">${tally.relay.length}</span></span>
        <span class="small muted">${tally.relay.length ? tally.relay.map(esc).join(', ') : '없음'}</span>
      </li>`
    : ''

  const people = [...view.entries]
    .sort((a, b) => name(a.memberId).localeCompare(name(b.memberId), 'ko'))
    .map(
      (e) => `<li class="list-row wrap">
          <strong class="entry-person">${esc(name(e.memberId))}</strong>
          <span class="list-note">${[...sortEvents(e.events).map(eventLabel), e.relay ? '단체전' : ''].filter(Boolean).join(' · ')}${e.note ? ` — ${esc(e.note)}` : ''}</span>
        </li>`,
    )
    .join('')

  return `${adminHeadHtml('competitions', c.name)}
    <div class="page-body">
      <a class="small" href="#/admin/competitions">← 대회 신청</a>
      ${view.saved ? '<p class="form-ok" role="status">저장했습니다.</p>' : ''}
      ${errorHtml(view.error)}
      <section class="card stack-s">
        <p class="small muted">${competitionFacts(c)}</p>
        <p class="lead">신청 ${view.entries.length}명${c.relays ? ` · 단체전 가능 ${tally.relay.length}명` : ''}</p>
        <div class="row wrap">
          <button type="button" class="button small-button" data-action="download-entries" data-id="${esc(c.id)}">엑셀 내려받기</button>
          ${c.relays ? `<a class="button small-button primary-small" href="#/admin/relay?c=${encodeURIComponent(c.id)}">단체전 명단 짜기</a>` : ''}
        </div>
      </section>
      <section class="card">
        <h2>종목별</h2>
        <ul class="list">${byEvent}${relayRow}</ul>
      </section>
      <section class="card list-card">
        <ul class="list">${people || '<li class="list-row muted">아직 신청한 회원이 없습니다.</li>'}</ul>
      </section>
      <details class="card">
        <summary><h2>대회 고치기</h2></summary>
        <form id="competition-edit-form" class="stack" novalidate>
          <input type="hidden" name="id" value="${esc(c.id)}" />
          ${competitionFieldsHtml(c, view.today)}
          <p class="hint">종목을 빼도 이미 그 종목을 신청한 회원의 신청은 남습니다. 회원에게 다시 신청해 달라고 알려 주세요.</p>
          <button class="button primary" type="submit">저장</button>
        </form>
      </details>
      <section class="card stack-s">
        <h2>대회 지우기</h2>
        <p class="small muted">신청 ${view.entries.length}건이 함께 지워집니다. 되살릴 수 없습니다.</p>
        <button type="button" class="button danger-quiet" data-action="delete-competition" data-id="${esc(c.id)}">이 대회 지우기</button>
      </section>
    </div>`
}

// ── 운영자: 단체전 명단 ──────────────────────────────────────

export interface AdminRelayView {
  /** 대회에서 왔으면 그 대회. 아니면 회원 전원이 후보. */
  competition: Competition | null
  /** 'relay' = 대회 신청에서 단체전 가능에 표시한 회원, 'all' = 활동 중인 회원 전원. */
  pool: 'relay' | 'all'
  options: RelayOptions
  swimmers: RelaySwimmer[]
  result: RelayResult
  /** 기록을 이 날부터 본다. */
  since: string
}

const strokeShort = (s: RelayTeam['legs'][number]['stroke']) => STROKE_LABEL[s]

function teamHtml(team: RelayTeam, index: number, options: RelayOptions): string {
  const legs = team.legs
    .map(
      (leg, i) => `<li class="leg">
          <span class="leg-no">${i + 1}</span>
          <span class="leg-stroke">${strokeShort(leg.stroke)}</span>
          <span class="leg-name">${esc(leg.swimmer.name)}${leg.swimmer.birthYear ? ` <span class="small muted">${options.year - leg.swimmer.birthYear}세</span>` : ''}</span>
          <span class="num leg-time">${formatTime(leg.splitCs)}</span>
        </li>`,
    )
    .join('')
  return `<section class="card relay-team">
      <div class="row baseline">
        <h2>${String.fromCharCode(65 + index)}팀</h2>
        <span class="relay-total num">${formatTime(team.totalCs)}</span>
      </div>
      <ul class="list legs">${legs}</ul>
      <p class="small muted">50m 최고기록 합 ${formatTime(team.rawCs)} − 인계 보정 ${seconds(options.takeoverCs)}초 × 3${team.ageSum !== null ? ` · 연령 합 ${team.ageSum}세` : ''}</p>
    </section>`
}

export function adminRelayHtml(view: AdminRelayView): string {
  const { options, result } = view
  const kindOptions = (Object.keys(RELAY_KIND_LABEL) as RelayKind[])
    .map((k) => `<option value="${k}"${k === options.kind ? ' selected' : ''}>${RELAY_KIND_LABEL[k]}</option>`)
    .join('')
  const genderOptions = (Object.keys(RELAY_GENDER_LABEL) as RelayGender[])
    .map((g) => `<option value="${g}"${g === options.gender ? ' selected' : ''}>${RELAY_GENDER_LABEL[g]}${g === 'X' ? ' (남 2 · 여 2)' : ''}</option>`)
    .join('')

  // 혼계영에서 한 영법을 할 사람이 아무도 없으면 팀이 비기만 한다 — 왜 비었는지 밝힌다.
  const missing =
    options.kind === 'medley'
      ? MEDLEY_ORDER.filter((s) => !view.swimmers.some((w) => w.bests[s] !== undefined)).map((s) => `${STROKE_LABEL[s]} 50m`)
      : []
  const empty =
    result.teams.length === 0
      ? `<section class="card soft"><p class="small">조건에 맞는 팀을 만들 수 없습니다.${
          missing.length ? ` 후보 중에 ${missing.join(' · ')} 기록이 있는 사람이 없습니다.` : ' 성별 · 연령 조건이나 후보를 넓혀 보세요.'
        }</p></section>`
      : ''

  const excluded = result.excluded.length
    ? `<details class="card">
        <summary><h2>빠진 사람 ${result.excluded.length}명</h2></summary>
        <ul class="list">${result.excluded.map((x) => `<li class="list-row"><span class="grow">${esc(x.name)}</span><span class="small muted">${esc(x.reason)}</span></li>`).join('')}</ul>
        <p class="hint">성별 · 출생연도는 [회원]에서, 기록은 [기록]에서 넣으면 다음 계산에 들어옵니다.</p>
      </details>`
    : ''

  const poolField = view.competition
    ? `<div class="field">
        <label for="relay-pool">후보</label>
        <select id="relay-pool" name="pool">
          <option value="relay"${view.pool === 'relay' ? ' selected' : ''}>신청에서 단체전 가능이라고 한 회원</option>
          <option value="all"${view.pool === 'all' ? ' selected' : ''}>활동 중인 회원 전원</option>
        </select>
      </div>`
    : ''

  return `${adminHeadHtml('competitions', '단체전 명단')}
    <div class="page-body">
      <a class="small" href="${view.competition ? `#/admin/competition?id=${encodeURIComponent(view.competition.id)}` : '#/admin/competitions'}">← ${view.competition ? esc(view.competition.name) : '대회 신청'}</a>
      <form id="relay-form" class="card stack" novalidate>
        ${view.competition ? `<input type="hidden" name="competition" value="${esc(view.competition.id)}" />` : ''}
        <div class="grid-2">
          <div class="field">
            <label for="relay-kind">종목</label>
            <select id="relay-kind" name="kind">${kindOptions}</select>
          </div>
          <div class="field">
            <label for="relay-gender">구분</label>
            <select id="relay-gender" name="gender">${genderOptions}</select>
          </div>
        </div>
        ${poolField}
        <div class="grid-2">
          <div class="field">
            <label for="relay-age-min">연령 합 최소 <span class="muted">(선택)</span></label>
            <input id="relay-age-min" name="ageMin" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="${options.ageMin ?? ''}" placeholder="160" />
          </div>
          <div class="field">
            <label for="relay-age-max">연령 합 최대 <span class="muted">(선택)</span></label>
            <input id="relay-age-max" name="ageMax" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="${options.ageMax ?? ''}" placeholder="199" />
          </div>
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="relay-takeover">인계 보정 (초)</label>
            <input id="relay-takeover" name="takeover" inputmode="decimal" maxlength="4" value="${seconds(options.takeoverCs)}" />
          </div>
          <div class="field">
            <label for="relay-teams">팀 수</label>
            <select id="relay-teams" name="teams">${[1, 2, 3].map((n) => `<option value="${n}"${n === options.teams ? ' selected' : ''}>${n}팀</option>`).join('')}</select>
          </div>
        </div>
        <button class="button primary" type="submit">명단 계산</button>
        <p class="hint">${view.since} 이후 50m 최고기록으로 계산합니다(25m 단수 기록 그대로). 연령은 ${options.year}년 기준 마스터즈 나이 — 대회 요강의 연령 합 구분을 넣으세요. 2~4번 영자는 인계 출발이라 다리마다 보정만큼 뺍니다. 보정값은 코치와 정하는 잠정값입니다.</p>
      </form>
      <p class="small muted">후보 ${result.candidates}명 · ${RELAY_KIND_LABEL[options.kind]} ${RELAY_GENDER_LABEL[options.gender]}</p>
      ${result.teams.map((team, i) => teamHtml(team, i, options)).join('')}
      ${empty}
      ${excluded}
      <p class="hint">빠른 팀부터 차례로 뽑고 그 네 명을 뺀 뒤 다음 팀을 뽑습니다. 팀 합계를 고르게 나누는 방식은 아닙니다.</p>
    </div>`
}
