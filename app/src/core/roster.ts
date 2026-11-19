/**
 * 회원 일괄 등록 명단 읽기.
 *
 * **한 줄에 한 명.** 이름 뒤에 쉼표나 탭으로 성별 · 출생연도 · 초기 비밀번호를 붙일 수 있다.
 * 순서는 상관없고 전부 선택이다 — 칸의 모양으로 알아본다.
 *
 *   홍길동
 *   김철수, 남, 1985
 *   이영희	여	1990	swim1234        ← 스프레드시트에서 복사하면 탭
 *   3. 박민수, 1978, 남, nineteen7
 *
 * - 성별: `남` `여` `남자` `여자` `M` `F`
 * - 출생연도: 네 자리(`1985`, `1985년`, `1985년생`)
 * - 그 밖의 칸은 초기 비밀번호. 비밀번호에는 쉼표 · 탭을 쓸 수 없다.
 *
 * 문제가 하나라도 있으면 아무도 만들지 않는 것이 호출 쪽 규칙이다. 반쯤 들어간 명단을
 * 운영자가 폰으로 골라 고치는 것보다, 명단을 고쳐 다시 붙이는 편이 쉽다.
 */
import { PASSWORD_MIN } from './invite'
import type { Sex } from './types'

/** `members.display_name` 의 check 와 같다. */
export const NAME_MAX = 30
/** 한 번에 넣는 최대 인원. 동호회 전체(30~100명)가 한 번에 들어가는 정도. */
export const ROSTER_MAX = 100
/** `members.birth_year` 의 check 와 같다. */
export const BIRTH_YEAR_MIN = 1920
export const BIRTH_YEAR_MAX = 2020

export interface RosterProblem {
  /** 붙여 넣은 글의 몇째 줄인지(1부터). */
  line: number
  name: string
  reason: string
}

export interface RosterEntry {
  name: string
  sex: Sex | null
  birthYear: number | null
  /** 줄에 적힌 초기 비밀번호. 없으면 공통 비밀번호나 초대코드로 간다. */
  password: string | null
}

export interface Roster {
  /** 만들 사람. 붙여 넣은 순서 그대로. */
  entries: RosterEntry[]
  problems: RosterProblem[]
}

const BULLET = /^(\d+\s*[.)]|[-*•·])\s*/
const SEX_WORD: Record<Sex, string> = { M: '남', F: '여' }
const SEX: Record<string, Sex> = { 남: 'M', 남자: 'M', m: 'M', 여: 'F', 여자: 'F', f: 'F' }
const YEAR = /^(\d{4})(년생?)?$/

export function readSex(text: string): Sex | null {
  const key = text.trim().toLowerCase()
  return Object.hasOwn(SEX, key) ? SEX[key]! : null
}

/** 출생연도 칸. 비었으면 null, 읽을 수 없으면 NaN. */
export function readBirthYear(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const match = YEAR.exec(trimmed)
  const year = match ? Number(match[1]) : Number.NaN
  return year >= BIRTH_YEAR_MIN && year <= BIRTH_YEAR_MAX ? year : Number.NaN
}

// ── 이미 있는 회원의 성별 · 출생연도 한꺼번에 넣기 ───────────────
//
// 네이버 자동 연결이 이름 + 출생연도를 본다(ADR-0012). 운영진이 가진 파일을 그대로 붙여 넣어
// 앱 명단과 **대조**한다. 형식은 회원 추가 명단과 같다 — `홍길동, 1985` · `김철수\t남\t1979`.
// 비밀번호 칸은 받지 않는다(여기는 정보만 고친다).
//
// **빈 칸만 채운다.** 앱에 이미 값이 있고 파일과 다르면 바꾸지 않고 `conflicts` 로 알린다 —
// 어느 쪽이 맞는지는 운영자가 회원 한 명 화면에서 정한다. 파일 한 줄의 오타가 네이버 자동 연결을
// 조용히 깨뜨리지 않게 하려는 것이다.

export interface ProfileUpdate {
  memberId: string
  name: string
  /** null 이면 그 칸은 그대로 둔다. */
  sex: Sex | null
  birthYear: number | null
}

/** 앱 명단과 파일이 다른 칸. 바꾸지 않았다. */
export interface ProfileConflict {
  name: string
  field: 'sex' | 'birthYear'
  current: string
  file: string
}

export interface ProfileUpdates {
  updates: ProfileUpdate[]
  /** 고쳐야 저장할 수 있는 줄(읽을 수 없는 칸 · 겹치는 줄). */
  problems: RosterProblem[]
  /** 출생연도 칸이 엑셀 오류값(`#VALUE!` 등)이라 건너뛴 이름. */
  skipped: string[]
  /** 앱 명단에 없는 이름. 막지 않고 알려만 준다 — 운영진 파일에는 탈퇴 · 미등록 회원이 섞여 있다. */
  unmatched: string[]
  /** 앱 명단과 값이 다른 칸. */
  conflicts: ProfileConflict[]
  /** 앱 명단과 이미 똑같아 바꿀 것이 없던 사람 수. */
  unchanged: number
}

/** 엑셀이 계산하지 못한 칸 — `#VALUE!` `#N/A` `#REF!` `#NAME?` `#DIV/0!` … */
const EXCEL_ERROR = /^#[A-Z0-9/]+[!?]?$/i
const FULL_DATE = /^(\d{4})[-./]?\d{1,2}[-./]?\d{1,2}\.?$/

/**
 * 한 줄을 이름과 나머지 칸으로 나눈다. 쉼표 · 탭이 있으면 그것으로, 없으면(채팅 · 메모장에서
 * 옮기며 탭이 공백이 된 경우) 공백으로 나누고 **끝에서부터** 성별 · 연도로 읽히는 칸을 떼어 낸다.
 * 그래서 `김민수 2 남 1985` 의 이름은 `김민수 2` 로 남는다.
 */
function splitProfileLine(raw: string): [string, string[]] {
  if (/[,\t]/.test(raw)) {
    const [first = '', ...rest] = raw.split(/[,\t]/)
    return [first, rest]
  }
  const words = raw.trim().split(/\s+/)
  const rest: string[] = []
  while (words.length > 1) {
    const last = words[words.length - 1]!
    if (!(readSex(last) || YEAR.test(last) || FULL_DATE.test(last) || EXCEL_ERROR.test(last))) break
    rest.unshift(words.pop()!)
  }
  return [words.join(' '), rest]
}

export function parseProfileUpdates(
  text: string,
  members: readonly { id: string; displayName: string; sex?: Sex | null; birthYear?: number | null }[],
): ProfileUpdates {
  const byName = new Map(members.map((m) => [m.displayName, m]))
  const seen = new Map<string, number>()
  const result: ProfileUpdates = { updates: [], problems: [], skipped: [], unmatched: [], conflicts: [], unchanged: 0 }

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1
    const [first, rest] = splitProfileLine(raw)
    const name = first.trim().replace(BULLET, '').replace(/\s+/g, ' ').trim()
    if (!name) return
    // 스프레드시트 머리글 줄(이름 · 출생연도)은 조용히 넘긴다.
    if (line === 1 && /^(이름|성명|name)$/i.test(name)) return

    const problem = (reason: string) => result.problems.push({ line, name, reason })
    let sex: Sex | null = null
    let birthYear: number | null = null
    let broken = false
    let ok = true
    for (const piece of rest) {
      const field = piece.trim()
      if (!field) continue
      if (EXCEL_ERROR.test(field)) {
        broken = true
        continue
      }
      const readAsSex = readSex(field)
      if (readAsSex && sex === null) {
        sex = readAsSex
        continue
      }
      // 생년월일 전체(1985-03-14 · 1985.03.14 · 19850314)가 와도 연도만 쓴다.
      const year = readBirthYear(YEAR.test(field) ? field : (FULL_DATE.exec(field)?.[1] ?? field))
      if (birthYear === null && year !== null && !Number.isNaN(year)) {
        birthYear = year
        continue
      }
      problem(`읽을 수 없는 칸 '${field.slice(0, 12)}' — 성별(남 · 여)과 출생연도(1985)만 적습니다`)
      ok = false
    }

    const member = byName.get(name)
    if (!ok) return
    // 출생연도가 엑셀 오류인 줄은 통째로 뺀다 — 성별만 바꾸는 일도 하지 않는다.
    if (broken && birthYear === null) result.skipped.push(name)
    else if (!member) result.unmatched.push(name)
    else if (seen.has(name)) problem(`${seen.get(name)}째 줄과 겹칩니다`)
    else if (sex === null && birthYear === null) problem('성별이나 출생연도가 없습니다')
    else {
      seen.set(name, line)
      // 빈 칸만 채운다. 이미 있고 다르면 알리기만 한다.
      const currentSex = member.sex ?? null
      const currentYear = member.birthYear ?? null
      let fillSex: Sex | null = null
      let fillYear: number | null = null
      if (sex !== null && currentSex === null) fillSex = sex
      else if (sex !== null && currentSex !== sex)
        result.conflicts.push({ name, field: 'sex', current: SEX_WORD[currentSex!], file: SEX_WORD[sex] })
      if (birthYear !== null && currentYear === null) fillYear = birthYear
      else if (birthYear !== null && currentYear !== birthYear)
        result.conflicts.push({ name, field: 'birthYear', current: String(currentYear), file: String(birthYear) })
      if (fillSex !== null || fillYear !== null) result.updates.push({ memberId: member.id, name, sex: fillSex, birthYear: fillYear })
      else if (!result.conflicts.some((c) => c.name === name)) result.unchanged++
    }
  })

  return result
}

export function parseRoster(text: string, existing: readonly string[]): Roster {
  const taken = new Set(existing)
  const seen = new Map<string, number>()
  const entries: RosterEntry[] = []
  const problems: RosterProblem[] = []

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1
    const [first = '', ...rest] = raw.split(/[,\t]/)
    const name = first.trim().replace(BULLET, '').replace(/\s+/g, ' ').trim()
    if (!name) {
      if (rest.some((field) => field.trim())) problems.push({ line, name: raw.trim(), reason: '이름이 맨 앞에 와야 합니다' })
      return
    }

    const entry: RosterEntry = { name, sex: null, birthYear: null, password: null }
    const problem = (reason: string) => problems.push({ line, name, reason })
    let ok = true

    for (const piece of rest) {
      const field = piece.trim()
      if (!field) continue
      const sex = readSex(field)
      if (sex && entry.sex === null) {
        entry.sex = sex
        continue
      }
      if (YEAR.test(field) && entry.birthYear === null) {
        const year = readBirthYear(field)
        if (year === null || Number.isNaN(year)) {
          problem(`출생연도는 ${BIRTH_YEAR_MIN}~${BIRTH_YEAR_MAX} 사이로 적어 주세요`)
          ok = false
        } else {
          entry.birthYear = year
        }
        continue
      }
      if (entry.password === null) {
        if (field.length < PASSWORD_MIN) {
          // 비밀번호 자체는 오류 문구에 싣지 않는다.
          problem(`비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다 (성별 · 연도로 읽지 못한 칸도 비밀번호로 봅니다)`)
          ok = false
        } else {
          entry.password = field
        }
        continue
      }
      problem('알 수 없는 칸이 있습니다 — 이름, 성별, 출생연도, 비밀번호까지만 적습니다')
      ok = false
    }

    if (name.length > NAME_MAX) {
      problem(`${NAME_MAX}자를 넘습니다`)
    } else if (taken.has(name)) {
      problem('이미 등록된 이름입니다')
    } else if (seen.has(name)) {
      problem(`${seen.get(name)}째 줄과 겹칩니다`)
    } else if (ok) {
      seen.set(name, line)
      entries.push(entry)
    }
  })

  return { entries, problems }
}
