import { describe, expect, test } from 'bun:test'
import { parseProfileUpdates, parseRoster, readBirthYear, readSex } from './roster'

const names = (text: string) => parseRoster(text, []).entries.map((e) => e.name)

test('한 줄에 한 명, 빈 줄과 앞뒤 공백은 버린다', () => {
  expect(parseRoster('홍길동\n\n  김철수  \r\n이영희\n', [])).toEqual({
    entries: [
      { name: '홍길동', sex: null, birthYear: null, password: null },
      { name: '김철수', sex: null, birthYear: null, password: null },
      { name: '이영희', sex: null, birthYear: null, password: null },
    ],
    problems: [],
  })
})

test('번호와 글머리는 떼고, 안쪽 공백은 하나로', () => {
  expect(names('1. 홍길동\n2) 김철수\n- 이영희\n• 박민수\n10.최지우\nJohn   Smith')).toEqual([
    '홍길동',
    '김철수',
    '이영희',
    '박민수',
    '최지우',
    'John Smith',
  ])
})

test('이름 속 숫자는 남긴다 — 동명이인 구분', () => {
  expect(names('김민수A\n김민수2')).toEqual(['김민수A', '김민수2'])
})

test('성별 · 출생연도 · 비밀번호 — 쉼표나 탭, 순서 무관', () => {
  const { entries, problems } = parseRoster('김철수, 남, 1985\n이영희\t여\t1990\tswim1234\n박민수, 1978년생, swimmer7, M', [])
  expect(problems).toEqual([])
  expect(entries).toEqual([
    { name: '김철수', sex: 'M', birthYear: 1985, password: null },
    { name: '이영희', sex: 'F', birthYear: 1990, password: 'swim1234' },
    { name: '박민수', sex: 'M', birthYear: 1978, password: 'swimmer7' },
  ])
})

test('짧은 비밀번호 · 이상한 연도 · 남는 칸은 문제로, 비밀번호는 문구에 싣지 않는다', () => {
  const { entries, problems } = parseRoster('김철수, 남, 123\n이영희, 1850\n박민수, abcdef1, extra12', [])
  expect(entries).toEqual([])
  expect(problems.map((p) => [p.line, p.name])).toEqual([
    [1, '김철수'],
    [2, '이영희'],
    [3, '박민수'],
  ])
  expect(problems[0]!.reason).toContain('6자 이상')
  expect(problems[1]!.reason).toContain('출생연도')
  expect(problems.map((p) => p.reason).join(' ')).not.toContain('123')
})

test('이미 있는 이름 · 명단 안 중복 · 너무 긴 이름은 문제로', () => {
  const { entries, problems } = parseRoster(`홍길동\n오승현\n김철수\n홍길동\n${'가'.repeat(31)}`, ['오승현'])
  expect(entries.map((e) => e.name)).toEqual(['홍길동', '김철수'])
  expect(problems).toEqual([
    { line: 2, name: '오승현', reason: '이미 등록된 이름입니다' },
    { line: 4, name: '홍길동', reason: '1째 줄과 겹칩니다' },
    { line: 5, name: '가'.repeat(31), reason: '30자를 넘습니다' },
  ])
})

test('빈 글은 아무것도 없다', () => {
  expect(parseRoster('  \n\n', [])).toEqual({ entries: [], problems: [] })
})

test('칸 읽기', () => {
  expect(readSex(' 여자 ')).toBe('F')
  expect(readSex('m')).toBe('M')
  expect(readSex('남성')).toBeNull()
  expect(readBirthYear('')).toBeNull()
  expect(readBirthYear('1985년')).toBe(1985)
  expect(readBirthYear('85')).toBeNaN()
  expect(readBirthYear('2030')).toBeNaN()
})

describe('이미 있는 회원의 성별 · 출생연도', () => {
  const members = [
    { id: 'a', displayName: '홍길동' },
    { id: 'b', displayName: '김민수A' },
    { id: 'c', displayName: '이영희' },
  ]

  test('스프레드시트 붙여넣기 — 머리글은 넘기고, 생년월일은 연도만', () => {
    const { updates, problems } = parseProfileUpdates('이름\t출생연도\n홍길동\t1985\n김민수A, 남, 1979-03-14\n이영희\t19900102\t여', members)
    expect(problems).toEqual([])
    expect(updates).toEqual([
      { memberId: 'a', name: '홍길동', sex: null, birthYear: 1985 },
      { memberId: 'b', name: '김민수A', sex: 'M', birthYear: 1979 },
      { memberId: 'c', name: '이영희', sex: 'F', birthYear: 1990 },
    ])
  })

  test('겹친 줄 · 빈 정보 · 읽을 수 없는 칸은 문제로, 명단에 없는 이름은 따로 알린다', () => {
    const { updates, problems, unmatched } = parseProfileUpdates('김민수, 1980\n홍길동, 1985\n홍길동, 1986\n이영희\n이영희, swim1234', members)
    expect(updates.map((u) => u.name)).toEqual(['홍길동'])
    expect(problems.map((p) => p.line)).toEqual([3, 4, 5])
    expect(unmatched).toEqual(['김민수'])
  })

  test('탭이 공백이 된 붙여넣기 · 엑셀 오류값(#VALUE!) 줄은 통째로 뺀다', () => {
    const text = '홍길동    남    1982\n김민수A 여 #VALUE!\n이영희 여 1993\n박없음    남    1980\n김민수 2 남 1985'
    const { updates, problems, skipped, unmatched } = parseProfileUpdates(text, [...members, { id: 'd', displayName: '김민수 2' }])
    expect(problems).toEqual([])
    expect(updates).toEqual([
      { memberId: 'a', name: '홍길동', sex: 'M', birthYear: 1982 },
      { memberId: 'c', name: '이영희', sex: 'F', birthYear: 1993 },
      { memberId: 'd', name: '김민수 2', sex: 'M', birthYear: 1985 },
    ])
    expect(skipped).toEqual(['김민수A'])
    expect(unmatched).toEqual(['박없음'])
  })

  test('앱에 이미 있는 값은 덮어쓰지 않는다 — 빈 칸만 채우고 다른 값은 알린다', () => {
    const filled = [
      { id: 'a', displayName: '홍길동', sex: 'M' as const, birthYear: 1982 },
      { id: 'b', displayName: '김민수A', sex: 'M' as const, birthYear: 1979 },
      { id: 'c', displayName: '이영희', sex: null, birthYear: 1990 },
    ]
    const r = parseProfileUpdates('홍길동 남 1982\n김민수A 여 1980\n이영희 여 1990', filled)
    expect(r.unchanged).toBe(1)
    expect(r.updates).toEqual([{ memberId: 'c', name: '이영희', sex: 'F', birthYear: null }])
    expect(r.conflicts).toEqual([
      { name: '김민수A', field: 'sex', current: '남', file: '여' },
      { name: '김민수A', field: 'birthYear', current: '1979', file: '1980' },
    ])
  })
})
