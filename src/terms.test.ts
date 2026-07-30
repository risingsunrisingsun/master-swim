import { describe, expect, test } from 'bun:test'
import {
  buildQuiz,
  CATEGORY_LABEL,
  OPTION_COUNT,
  quizVerdict,
  searchTerms,
  termById,
  termsByCategory,
  TERMS,
  type TermCategory,
} from './terms'

/** 0, 1/n, 2/n … 을 돌려주는 가짜 난수. 섞는 규칙을 고정해 검사할 수 있게 한다. */
const seeded = (values: readonly number[]): (() => number) => {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('용어집 무결성', () => {
  test('아이디가 겹치지 않는다', () => {
    const ids = TERMS.map((term) => term.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('용어 이름도 겹치지 않는다 — 겹치면 퀴즈 보기에 같은 답이 둘 뜬다', () => {
    const names = TERMS.map((term) => term.term)
    expect(new Set(names).size).toBe(names.length)
  })

  test('모든 용어에 한 줄 정의가 있다', () => {
    for (const term of TERMS) {
      expect(term.term.length).toBeGreaterThan(0)
      expect(term.short.length).toBeGreaterThan(10)
    }
  })

  test('모든 분류에 용어가 있다', () => {
    for (const category of Object.keys(CATEGORY_LABEL) as TermCategory[]) {
      expect(termsByCategory(category).length).toBeGreaterThan(0)
    }
  })

  // 보기 네 개를 같은 분류에서 채우려면 분류마다 최소 네 개가 필요하다.
  // 모자라면 다른 분류에서 채우게 되어 소거법으로 맞힐 수 있다(`distractorsFor`).
  test('분류마다 보기를 채울 만큼 용어가 있다', () => {
    for (const category of Object.keys(CATEGORY_LABEL) as TermCategory[]) {
      expect(termsByCategory(category).length).toBeGreaterThanOrEqual(OPTION_COUNT)
    }
  })

  test('termById 는 있는 것만 찾는다', () => {
    expect(termById('dps')?.term).toBe('DPS')
    expect(termById('없는용어')).toBeUndefined()
  })
})

describe('buildQuiz', () => {
  const rng = seeded([0.1, 0.4, 0.7, 0.2, 0.9, 0.5, 0.3, 0.8])

  test('요청한 수만큼 문제를 낸다', () => {
    expect(buildQuiz(10, rng).length).toBe(10)
    expect(buildQuiz(3, rng).length).toBe(3)
  })

  test('용어 수보다 많이 요청해도 용어 수를 넘지 않는다', () => {
    expect(buildQuiz(9999, rng).length).toBe(TERMS.length)
  })

  test('0 이하를 요청하면 빈 배열', () => {
    expect(buildQuiz(0, rng)).toEqual([])
    expect(buildQuiz(-5, rng)).toEqual([])
  })

  test('한 판 안에서 같은 용어가 두 번 나오지 않는다', () => {
    const quiz = buildQuiz(TERMS.length, rng)
    expect(new Set(quiz.map((q) => q.termId)).size).toBe(quiz.length)
  })

  test('보기는 네 개이고 서로 다르다', () => {
    for (const question of buildQuiz(TERMS.length, rng)) {
      expect(question.options.length).toBe(OPTION_COUNT)
      expect(new Set(question.options).size).toBe(OPTION_COUNT)
    }
  })

  // 정답 위치가 틀리면 다 맞혀도 0점이 된다. 방향이 뒤집히기 쉬운 값이다.
  test('answer 가 가리키는 보기가 실제 그 용어다', () => {
    for (const question of buildQuiz(TERMS.length, rng)) {
      expect(question.options[question.answer]).toBe(termById(question.termId)!.term)
    }
  })

  test('문제는 그 용어의 정의이고 정답 용어를 그대로 담고 있지 않다', () => {
    for (const question of buildQuiz(TERMS.length, rng)) {
      const term = termById(question.termId)!
      expect(question.prompt).toBe(term.short)
      // 정의 안에 용어가 그대로 들어 있으면 읽자마자 답이 보인다.
      expect(question.prompt).not.toContain(term.term)
    }
  })

  test('설명이 비어 있지 않다 — 틀린 채로 넘어가면 퀴즈가 아니다', () => {
    for (const question of buildQuiz(TERMS.length, rng)) {
      expect(question.explain.length).toBeGreaterThan(10)
    }
  })

  test('정답 위치가 한 자리에 몰리지 않는다', () => {
    const positions = new Set(buildQuiz(TERMS.length, Math.random).map((q) => q.answer))
    expect(positions.size).toBeGreaterThan(1)
  })
})

describe('quizVerdict', () => {
  test('만점과 낮은 점수의 말이 다르다', () => {
    expect(quizVerdict(10, 10)).toContain('전부')
    expect(quizVerdict(2, 10)).toContain('용어집')
  })

  test('문제가 없으면 빈 문자열 — 0으로 나누지 않는다', () => {
    expect(quizVerdict(0, 0)).toBe('')
  })
})

describe('searchTerms', () => {
  test('빈 입력은 빈 배열 — 화면이 전체 목록으로 돌아갈 수 있어야 한다', () => {
    expect(searchTerms('')).toEqual([])
    expect(searchTerms('   ')).toEqual([])
  })

  test('표제어로 찾는다', () => {
    const found = searchTerms('플립턴')
    expect(found.map((term) => term.id)).toContain('flip-turn')
  })

  test('영어 표기로도 찾는다 — 코치가 영어로 부르는 경우가 많다', () => {
    expect(searchTerms('EVF').map((term) => term.id)).toContain('high-elbow')
    expect(searchTerms('pace clock').map((term) => term.id)).toContain('pace-clock')
  })

  test('대소문자를 가리지 않는다', () => {
    expect(searchTerms('dps').map((term) => term.id)).toContain('dps')
    expect(searchTerms('DPS').map((term) => term.id)).toContain('dps')
  })

  test('정의문에 있는 말로도 찾힌다', () => {
    // '앞구르기'는 플립턴의 정의문에만 있고 표제어에는 없다.
    expect(searchTerms('앞구르기').map((term) => term.id)).toContain('flip-turn')
  })

  test('표제어에 맞은 것이 정의문에 맞은 것보다 앞에 온다', () => {
    const found = searchTerms('스컬링')
    expect(found[0]!.id).toBe('sculling')
  })

  test('같은 용어가 두 번 나오지 않는다', () => {
    // 표제어와 정의문에 모두 들어 있어도 한 번만 나와야 한다.
    const ids = searchTerms('스트로크').map((term) => term.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('없는 말은 빈 배열', () => {
    expect(searchTerms('싱크로나이즈드')).toEqual([])
  })
})

describe('호흡 용어', () => {
  // 저호흡은 물속 의식 소실 위험이 있어 처방하지 않는다. 용어집에는 두되
  // 처방하지 않는다는 사실을 함께 적어야 회원이 어디서 듣고 와도 알 수 있다.
  test('저호흡은 처방하지 않는다고 밝힌다', () => {
    const term = termById('hypoxic')!
    expect(term.detail).toContain('처방하지 않는다')
    expect(term.detail).toContain('의식 소실')
  })

  test('양측 호흡과 호흡 타이밍이 용어집에 있다', () => {
    expect(termById('bilateral')).toBeDefined()
    expect(termById('breath-timing')).toBeDefined()
  })
})
