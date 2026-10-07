import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  formatCode,
  generateCode,
  isCodeShape,
  normalizeCode,
  passwordProblem,
} from './invite'

test('헷갈리는 글자가 없다', () => {
  for (const char of '0O1IL') expect(CODE_ALPHABET).not.toContain(char)
  expect(new Set(CODE_ALPHABET).size).toBe(CODE_ALPHABET.length)
})

test('서버 SQL 과 같은 알파벳을 쓴다', () => {
  const sql = readFileSync(`${import.meta.dir}/../../supabase/migrations/0001_members_meetings_attendance.sql`, 'utf8')
  expect(sql).toContain(`'${CODE_ALPHABET}'`)
  expect(sql).toContain(`% ${CODE_ALPHABET.length}`)
  const edge = readFileSync(`${import.meta.dir}/../../supabase/functions/redeem-invite/index.ts`, 'utf8')
  expect(edge).toContain(`'${CODE_ALPHABET}'`)
})

test('입력은 하이픈 · 공백 · 소문자를 받는다', () => {
  expect(normalizeCode(' abcd-efgh ')).toBe('ABCDEFGH')
  expect(isCodeShape(normalizeCode('abcd efgh'))).toBe(true)
  expect(isCodeShape('ABCDEFG')).toBe(false)
  expect(isCodeShape('ABCDEFG0')).toBe(false)
})

test('formatCode', () => {
  expect(formatCode('TEAM2345')).toBe('TEAM-2345')
})

test('generateCode 는 알파벳 안에서 8자', () => {
  let seed = 0
  const code = generateCode(() => (seed++ * 0.137) % 1)
  expect(code).toHaveLength(CODE_LENGTH)
  expect(isCodeShape(code)).toBe(true)
  expect(generateCode(() => 0.9999)).toBe('99999999')
})

test('passwordProblem', () => {
  expect(passwordProblem('12345', '12345')).toContain('6자')
  expect(passwordProblem('123456', '123457')).toContain('다릅니다')
  expect(passwordProblem('123456', '123456')).toBeNull()
})
