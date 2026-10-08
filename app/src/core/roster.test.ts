import { expect, test } from 'bun:test'
import { parseRoster } from './roster'

test('한 줄에 한 명, 빈 줄과 앞뒤 공백은 버린다', () => {
  expect(parseRoster('홍길동\n\n  김철수  \r\n이영희\n', [])).toEqual({
    names: ['홍길동', '김철수', '이영희'],
    problems: [],
  })
})

test('쉼표 · 탭으로 나눈 줄도 받는다', () => {
  expect(parseRoster('홍길동, 김철수\t이영희', []).names).toEqual(['홍길동', '김철수', '이영희'])
})

test('번호와 글머리는 떼고, 안쪽 공백은 하나로', () => {
  expect(parseRoster('1. 홍길동\n2) 김철수\n- 이영희\n• 박민수\n10.최지우\nJohn   Smith', []).names).toEqual([
    '홍길동',
    '김철수',
    '이영희',
    '박민수',
    '최지우',
    'John Smith',
  ])
})

test('이름 속 숫자는 남긴다 — 동명이인 구분', () => {
  expect(parseRoster('김민수A\n김민수2', []).names).toEqual(['김민수A', '김민수2'])
})

test('이미 있는 이름 · 명단 안 중복 · 너무 긴 이름은 문제로', () => {
  const { names, problems } = parseRoster(`홍길동\n오승현\n김철수\n홍길동\n${'가'.repeat(31)}`, ['오승현'])
  expect(names).toEqual(['홍길동', '김철수'])
  expect(problems).toEqual([
    { line: 2, name: '오승현', reason: '이미 등록된 이름입니다' },
    { line: 4, name: '홍길동', reason: '1째 줄과 겹칩니다' },
    { line: 5, name: '가'.repeat(31), reason: '30자를 넘습니다' },
  ])
})

test('빈 글은 아무것도 없다', () => {
  expect(parseRoster('  \n\n', [])).toEqual({ names: [], problems: [] })
})
