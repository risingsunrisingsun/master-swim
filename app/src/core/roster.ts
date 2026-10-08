/**
 * 회원 일괄 등록 명단 읽기.
 *
 * 카페 명단이나 단톡방에서 복사한 글을 그대로 받는다 — 한 줄에 한 명이 기본이고,
 * 쉼표 · 탭으로 나눈 줄과 `1. 홍길동` 같은 번호 · 글머리도 받는다.
 *
 * 문제가 하나라도 있으면 아무도 만들지 않는 것이 호출 쪽 규칙이다. 반쯤 들어간 명단을
 * 운영자가 폰으로 골라 고치는 것보다, 명단을 고쳐 다시 붙이는 편이 쉽다.
 */

/** `members.display_name` 의 check 와 같다. */
export const NAME_MAX = 30
/** 한 번에 넣는 최대 인원. 동호회 전체(30~100명)가 한 번에 들어가는 정도. */
export const ROSTER_MAX = 100

export interface RosterProblem {
  /** 붙여 넣은 글의 몇째 줄인지(1부터). */
  line: number
  name: string
  reason: string
}

export interface Roster {
  /** 만들 이름. 붙여 넣은 순서 그대로. */
  names: string[]
  problems: RosterProblem[]
}

const BULLET = /^(\d+\s*[.)]|[-*•·])\s*/

export function parseRoster(text: string, existing: readonly string[]): Roster {
  const taken = new Set(existing)
  const seen = new Map<string, number>()
  const names: string[] = []
  const problems: RosterProblem[] = []

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1
    for (const piece of raw.split(/[,\t]/)) {
      const name = piece.trim().replace(BULLET, '').replace(/\s+/g, ' ').trim()
      if (!name) continue
      if (name.length > NAME_MAX) {
        problems.push({ line, name, reason: `${NAME_MAX}자를 넘습니다` })
      } else if (taken.has(name)) {
        problems.push({ line, name, reason: '이미 등록된 이름입니다' })
      } else if (seen.has(name)) {
        problems.push({ line, name, reason: `${seen.get(name)}째 줄과 겹칩니다` })
      } else {
        seen.set(name, line)
        names.push(name)
      }
    }
  })

  return { names, problems }
}
