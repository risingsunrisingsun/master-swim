/**
 * 기록 화면 (기능2) — 회원의 추이 · 기록 넣기, 운영자의 모임 기록 입력.
 *
 * 사람이 넣은 글자(메모 · 이름 · 장소)는 전부 `esc` 를 거친다.
 */
import { shortDateLabel } from '../core/dates'
import { type NationalStanding, PERIOD_LABEL, type Period } from '../core/records'
import { eventKey, eventLabel, formatTime, hasMinuteField, timeFields } from '../core/time'
import {
  type Meeting,
  MEETING_KIND_LABEL,
  type Member,
  RECORD_EVENTS,
  type SwimEvent,
  type SwimRecord,
} from '../core/types'
import { type ChartPoint, recordChartHtml } from './chart'
import { adminHeadHtml, errorHtml, esc, icon } from './views'

const PLUS = '<path d="M12 5v14M5 12h14"/>'

export const meetingName = (meeting: Meeting): string =>
  `${shortDateLabel(meeting.date)} ${MEETING_KIND_LABEL[meeting.kind]}${meeting.place ? ` · ${meeting.place}` : ''}`

function eventOptions(events: readonly SwimEvent[], selected: SwimEvent | null, counts?: Map<string, number>): string {
  return events
    .map((event) => {
      const key = eventKey(event)
      const count = counts?.get(key)
      const on = selected && eventKey(selected) === key ? ' selected' : ''
      return `<option value="${key}"${on}>${eventLabel(event)}${count ? ` · ${count}개` : ''}</option>`
    })
    .join('')
}

/** 분 칸 · 초 칸 한 쌍. 50m 이하는 분 칸을 숨긴다(PRD-0001 §4.2). */
export function timeInputsHtml(prefix: string, distance: SwimEvent['distance'], cs: number | null, label: string): string {
  const fields = cs === null ? { minutes: '', seconds: '' } : timeFields(cs, distance)
  const minutesHidden = hasMinuteField(distance) ? '' : ' hidden'
  return `<div class="time-inputs" data-time="${prefix}">
      <label class="time-part min-part"${minutesHidden}>
        <input name="${prefix}-min" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${fields.minutes}" aria-label="${esc(label)} 분" />
        <span>분</span>
      </label>
      <label class="time-part">
        <input name="${prefix}-sec" inputmode="decimal" maxlength="5" value="${fields.seconds}" placeholder="32.40" aria-label="${esc(label)} 초" />
        <span>초</span>
      </label>
      <output class="time-readout" aria-live="polite">${cs === null ? '' : `= ${formatTime(cs)}`}</output>
    </div>`
}

// ── 나의 기록 ────────────────────────────────────────────────

export interface RecordsView {
  /** 기록이 하나도 없으면 null. */
  event: SwimEvent | null
  /** 기록이 있는 종목, 최근 순. */
  events: SwimEvent[]
  counts: Map<string, number>
  period: Period
  /** 고른 종목 · 기간의 기록, 날짜 순. */
  records: SwimRecord[]
  /** 고른 종목의 전체 기간 최고기록. */
  best: SwimRecord | null
  /** 최고기록의 국내 마스터즈 상위 %. 성별 · 출생연도가 없거나 분포가 없는 종목이면 null. */
  standing: NationalStanding | null
  pbIds: ReadonlySet<string>
  goalCs: number | null
  meetings: ReadonlyMap<string, Meeting>
  saved: boolean
  error: string | null
}

export function recordsHtml(view: RecordsView): string {
  const add = (key: string) =>
    `<a class="button primary icon-text" href="#/records/new${key ? `?e=${key}` : ''}">${icon(PLUS, 20)}기록 넣기</a>`

  if (!view.event) {
    return `<header class="page-head"><h1>나의 기록</h1></header>
      <div class="page-body">
        ${errorHtml(view.error)}
        <section class="card soft stack-s">
          <p>아직 기록이 없습니다.</p>
          <p class="small muted">혼자 잰 기록을 넣거나, 기록회에서 운영자가 넣은 기록이 여기에 모입니다.</p>
        </section>
        ${add('')}
      </div>`
  }

  const key = eventKey(view.event)
  const periods = (Object.keys(PERIOD_LABEL) as Period[])
    .map(
      (p) =>
        `<a href="#/records?e=${key}&p=${p}" class="segment${p === view.period ? ' is-on' : ''}"${p === view.period ? ' aria-current="true"' : ''}>${PERIOD_LABEL[p]}</a>`,
    )
    .join('')

  const best = view.best
  const goal =
    view.goalCs !== null && best
      ? best.timeCs > view.goalCs
        ? `<a class="small" href="#/sets?e=${key}">목표 ${formatTime(view.goalCs)}까지 ${((best.timeCs - view.goalCs) / 100).toFixed(2)}초 · 세트 보기</a>`
        : `<p class="small form-ok">목표 ${formatTime(view.goalCs)} 달성</p>`
      : `<a class="small" href="#/sets?e=${key}">목표를 정하고 단축 세트 보기</a>`
  const bestCard = best
    ? `<section class="card">
        <p class="small muted">최고기록</p>
        <p class="pb-number num">${formatTime(best.timeCs)}</p>
        <p class="small muted">${shortDateLabel(best.date)} · ${esc(sourceLabel(best, view.meetings))}</p>
        ${
          view.standing
            ? `<p class="small">국내 마스터즈 ${view.standing.group} 기준 <strong>상위 ${view.standing.topPercent}%</strong> <span class="muted">· 마이랭킹 기록 분포 ${view.standing.sampleSize.toLocaleString('ko-KR')}건에서 추정</span></p>`
            : ''
        }
        ${goal}
      </section>`
    : ''

  const points: ChartPoint[] = view.records.map((r) => ({
    date: r.date,
    timeCs: r.timeCs,
    source: r.source,
    pb: view.pbIds.has(r.id),
  }))

  const rows = [...view.records]
    .reverse()
    .map((r) => {
      const edit =
        r.source === 'self'
          ? `<a class="button small-button" href="#/records/edit?id=${encodeURIComponent(r.id)}">고치기</a>`
          : ''
      const note = r.note ? `<span class="small muted">${esc(r.note)}</span>` : ''
      return `<li class="record-row">
          <span class="list-date">${shortDateLabel(r.date)}</span>
          <span class="record-main">
            <span class="record-time num">${formatTime(r.timeCs)}${view.pbIds.has(r.id) ? ' <span class="chip chip-pb">PB</span>' : ''}</span>
            <span class="small muted">${esc(sourceLabel(r, view.meetings))}</span>
            ${note}
          </span>
          ${edit}
        </li>`
    })
    .join('')

  const status = view.saved ? `<p class="form-ok" role="status">저장했습니다.</p>` : ''

  return `<header class="page-head row">
      <h1>나의 기록</h1>
      <a class="icon-button" href="#/records/new?e=${key}" aria-label="기록 넣기">${icon(PLUS, 22)}</a>
    </header>
    <div class="page-body">
      ${status}${errorHtml(view.error)}
      <div class="field">
        <label for="records-event">종목</label>
        <select id="records-event" data-nav="records" data-period="${view.period}">${eventOptions(view.events, view.event, view.counts)}${eventOptions(
          RECORD_EVENTS.filter((e) => !view.counts.has(eventKey(e))),
          null,
        )}</select>
      </div>
      ${bestCard}
      <section class="card">
        <nav class="segmented compact" aria-label="기간">${periods}</nav>
        ${recordChartHtml(points, view.goalCs)}
      </section>
      <section class="card list-card">
        <ul class="list">${rows || `<li class="list-row muted">이 기간에는 기록이 없습니다.</li>`}</ul>
      </section>
      ${add(key)}
    </div>`
}

function sourceLabel(record: SwimRecord, meetings: ReadonlyMap<string, Meeting>): string {
  if (record.source === 'self') return '개인 입력'
  const meeting = record.meetingId ? meetings.get(record.meetingId) : undefined
  return meeting ? `모임 · ${MEETING_KIND_LABEL[meeting.kind]}${meeting.place ? ` · ${meeting.place}` : ''}` : '모임 기록'
}

// ── 기록 넣기 · 고치기 ───────────────────────────────────────

export interface RecordFormView {
  /** 고치기면 그 기록. */
  editing: SwimRecord | null
  event: SwimEvent
  date: string
  timeCs: number | null
  note: string
  today: string
  error: string | null
}

export function recordFormHtml(view: RecordFormView): string {
  const title = view.editing ? '기록 고치기' : '기록 넣기'
  const remove = view.editing
    ? `<button type="button" class="button danger-quiet" data-action="delete-record" data-id="${esc(view.editing.id)}">이 기록 지우기</button>`
    : ''
  return `<header class="page-head row">
      <h1>${title}</h1>
      <a class="small" href="#/records?e=${eventKey(view.event)}">취소</a>
    </header>
    <form id="record-form" class="page-body" novalidate>
      ${view.editing ? `<input type="hidden" name="id" value="${esc(view.editing.id)}" />` : ''}
      <div class="field">
        <label for="record-event">종목</label>
        <select id="record-event" name="event">${eventOptions(RECORD_EVENTS, view.event)}</select>
      </div>
      <div class="field">
        <label for="record-date">날짜</label>
        <input id="record-date" name="date" type="date" required max="${view.today}" value="${view.date}" />
      </div>
      <div class="field">
        <span class="label">기록 <span class="muted">(초 칸은 32.40 처럼)</span></span>
        ${timeInputsHtml('time', view.event.distance, view.timeCs, '기록')}
      </div>
      <div class="field">
        <label for="record-note">메모 <span class="muted">(선택)</span></label>
        <input id="record-note" name="note" maxlength="100" value="${esc(view.note)}" placeholder="예: 혼자 잼 · 수모 바꿈" />
      </div>
      ${errorHtml(view.error)}
      <button class="button primary" type="submit">저장</button>
      ${remove}
      <p class="hint">여기서 넣은 기록은 '개인 입력'으로 남습니다. 기록회 기록은 운영자가 넣습니다.</p>
    </form>`
}

// ── 운영자: 모임 기록 입력 ───────────────────────────────────

export interface AdminRecordsView {
  /** 고를 수 있는 모임(취소 제외 · 지난 것), 최신이 위. */
  meetings: Meeting[]
  selected: Meeting | null
  event: SwimEvent
  /** 출석한 회원이 위로 온다. */
  roster: Member[]
  present: ReadonlySet<string>
  /** 이미 저장된 기록, 또는 막혀서 되살린 입력. */
  values: ReadonlyMap<string, { minutes: string; seconds: string }>
  saved: boolean
  error: string | null
}

export function adminRecordsHtml(view: AdminRecordsView): string {
  const head = adminHeadHtml('records', '모임 기록')
  if (!view.selected) {
    return `${head}<div class="page-body"><section class="card soft"><p>기록을 넣을 모임이 없습니다. <a href="#/admin/meetings">모임을 먼저 만드세요.</a></p></section></div>`
  }

  const key = eventKey(view.event)
  const options = view.meetings
    .map(
      (m) =>
        `<option value="${m.id}"${m.id === view.selected?.id ? ' selected' : ''}>${esc(meetingName(m))}</option>`,
    )
    .join('')
  const withMinutes = hasMinuteField(view.event.distance)
  const filled = [...view.values.values()].filter((v) => v.seconds.trim() !== '').length

  const rows = view.roster
    .map((member) => {
      const value = view.values.get(member.id) ?? { minutes: '', seconds: '' }
      const absent = view.selected?.checkedAt && !view.present.has(member.id) ? '<span class="small muted">결석</span>' : ''
      const minutes = withMinutes
        ? `<input class="min-input" name="m-${member.id}" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${esc(value.minutes)}" aria-label="${esc(member.displayName)} 분" placeholder="분" />`
        : ''
      return `<li class="entry-row">
          <span class="entry-name">${esc(member.displayName)} ${absent}</span>
          ${minutes}
          <input class="sec-input" name="s-${member.id}" inputmode="decimal" maxlength="5" value="${esc(value.seconds)}" aria-label="${esc(member.displayName)} 초" placeholder="${withMinutes ? '초' : '32.40'}" />
        </li>`
    })
    .join('')

  const status = view.saved
    ? `<p class="form-ok" role="status">저장했습니다. 회원 기록 화면에 바로 보입니다.</p>`
    : `<p class="small muted">빈 칸은 기록 없음입니다. 저장하면 이 모임의 ${eventLabel(view.event)} 기록이 통째로 바뀝니다.</p>`

  return `${head}
    <form id="meeting-records-form" class="admin-form" novalidate>
      <input type="hidden" name="meeting" value="${view.selected.id}" />
      <input type="hidden" name="event" value="${key}" />
      <div class="page-body">
        <div class="grid-2">
          <div class="field">
            <label for="records-meeting">모임</label>
            <select id="records-meeting" data-nav="admin-records" data-event="${key}">${options}</select>
          </div>
          <div class="field">
            <label for="records-event-admin">종목</label>
            <select id="records-event-admin" data-nav="admin-records-event" data-meeting="${view.selected.id}">${eventOptions(RECORD_EVENTS, view.event)}</select>
          </div>
        </div>
        ${status}
        ${errorHtml(view.error)}
        <ul class="list entry-list${withMinutes ? ' with-minutes' : ''}">${rows}</ul>
      </div>
      <div class="sticky-foot">
        <p class="count"><span class="num" id="filled-count">${filled}</span> <span class="muted">/ ${view.roster.length}명</span></p>
        <button class="button primary grow" type="submit">기록 저장</button>
      </div>
    </form>`
}
