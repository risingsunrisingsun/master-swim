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
