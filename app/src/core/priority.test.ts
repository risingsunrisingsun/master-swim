import { expect, test } from 'bun:test'
import { BALANCE_GAP, diagnose, ENDURANCE_RATIO, PLATEAU_DAYS, PLATEAU_MIN_RECORDS } from './priority'
import type { Stroke, SwimRecord } from './types'

let n = 0
const rec = (stroke: Stroke, distance: 25 | 50 | 100, timeCs: number, date = '2026-10-01'): SwimRecord => ({
  id: `r${++n}`,
  memberId: 'm1',
  stroke,
  distance,
  timeCs,
  date,
  source: 'self',
  meetingId: null,
  note: '',
})

const TODAY = '2026-11-19'
const FREE50 = { stroke: 'free', distance: 50 } as const
const FREE100 = { stroke: 'free', distance: 100 } as const
/** 2026년에 50세 — 50대 분포. */
const BORN = 1976

const byKind = (d: ReturnType<typeof diagnose>, kind: string) => d.findings.find((f) => f.kind === kind)!

test('진단은 늘 넷, 정해진 순서', () => {
  const d = diagnose([], FREE50, null, null, TODAY)
  expect(d.findings.map((f) => f.kind)).toEqual(['endurance', 'speed', 'plateau', 'balance'])
  expect(d.findings.every((f) => f.status === 'need-data')).toBe(true)
  expect(d.primary).toBeNull()
})

test('후반 감속 — 100m 가 50m 두 배보다 기준 넘게 느리면 그것부터 (예시 그대로)', () => {
  const d = diagnose([rec('free', 50, 3233), rec('free', 100, 7420)], FREE50, 'M', BORN, TODAY)
  const e = byKind(d, 'endurance')
  // drop = 7420 − 6466 = 954, allowed = round(6466 × 0.12) = 776
  expect(Math.round(2 * 3233 * (ENDURANCE_RATIO - 1))).toBe(776)
  expect(e.status).toBe('focus')
  expect(e.title).toBe('후반 25m 버티기')
  expect(e.event).toEqual(FREE100)
  expect(e.detail).toBe('자유형 100m 최고 1:14.20, 50m 최고 32.33의 두 배보다 9.54초 느립니다. 기준은 7.76초입니다.')
  expect(d.primary).toBe(e)
  // 같은 영법에 할 일을 둘 겹쳐 내지 않는다.
  expect(byKind(d, 'speed').status).toBe('ok')
})

test('후반이 버티면 천장 — 최고 속도 올리기', () => {
  const d = diagnose([rec('free', 50, 3233), rec('free', 100, 7200)], FREE100, null, null, TODAY)
  expect(byKind(d, 'endurance').status).toBe('ok')
  const s = byKind(d, 'speed')
  expect(s.status).toBe('focus')
  expect(s.title).toBe('최고 속도 올리기')
  expect(s.event).toEqual(FREE50)
  expect(d.primary).toBe(s)
})

test('기준과 딱 같으면 양호', () => {
  // 50m 30.00 → allowed 720 → 100m 1:07.20
  const d = diagnose([rec('free', 50, 3000), rec('free', 100, 6720)], FREE50, null, null, TODAY)
  expect(byKind(d, 'endurance').status).toBe('ok')
})

test('100m 가 없으면 무엇을 재야 하는지 묻는다', () => {
  const d = diagnose([rec('breast', 50, 4000)], { stroke: 'breast', distance: 50 }, null, null, TODAY)
  const e = byKind(d, 'endurance')
  expect(e.status).toBe('need-data')
  expect(e.detail).toContain('평영 100m 기록을 한 번 재 보세요')
  expect(e.event).toEqual({ stroke: 'breast', distance: 100 })
})

test('50m 가 없으면 50m 를 묻는다', () => {
  const d = diagnose([rec('back', 100, 8000)], { stroke: 'back', distance: 100 }, null, null, TODAY)
  const e = byKind(d, 'endurance')
  expect(e.status).toBe('need-data')
  expect(e.event).toEqual({ stroke: 'back', distance: 50 })
  expect(byKind(d, 'speed').status).toBe('need-data')
})

test('50m 만 있으면 국내 분포 위치로 천장을 본다', () => {
  const slow = diagnose([rec('free', 50, 4000)], FREE50, 'M', BORN, TODAY)
  expect(byKind(slow, 'speed').status).toBe('focus')
  expect(byKind(slow, 'speed').detail).toContain('상위')
  const fast = diagnose([rec('free', 50, 3200)], FREE50, 'M', BORN, TODAY)
  expect(byKind(fast, 'speed').status).toBe('ok')
  // 성별 · 출생연도가 없으면 견줄 수 없다.
  const unknown = diagnose([rec('free', 50, 4000)], FREE50, null, null, TODAY)
  expect(byKind(unknown, 'speed').status).toBe('need-data')
})

test('정체 — PB 가 반년 넘게 그대로고 그 뒤로 여러 번 쟀으면', () => {
  const records = [
    rec('free', 50, 3233, '2026-03-01'),
    rec('free', 50, 3300, '2026-06-01'),
    rec('free', 50, 3280, '2026-08-01'),
    rec('free', 50, 3290, '2026-10-01'),
  ]
  const d = diagnose(records, FREE50, null, null, TODAY)
  const p = byKind(d, 'plateau')
  expect(p.status).toBe('focus')
  expect(p.title).toBe('자극 바꾸기')
  expect(p.event).toEqual(FREE50)
  expect(p.detail).toContain('3번')
})

test('정체가 아니다 — PB 가 최근이거나, 그 뒤로 잰 횟수가 모자라면', () => {
  const recent = [
    rec('free', 50, 3400, '2026-03-01'),
    rec('free', 50, 3350, '2026-06-01'),
    rec('free', 50, 3233, '2026-10-01'),
  ]
  expect(byKind(diagnose(recent, FREE50, null, null, TODAY), 'plateau').status).toBe('ok')

  const fewSince = [
    rec('free', 50, 3233, '2026-01-01'),
    rec('free', 50, 3300, '2026-06-01'),
    rec('free', 50, 3280, '2026-08-01'),
  ]
  expect(byKind(diagnose(fewSince, FREE50, null, null, TODAY), 'plateau').status).toBe('ok')
  expect(PLATEAU_DAYS).toBe(180)
})

test('기록이 적으면 정체를 판단하지 않는다', () => {
  const d = diagnose([rec('free', 50, 3233), rec('free', 50, 3300)], FREE50, null, null, TODAY)
  expect(byKind(d, 'plateau').status).toBe('need-data')
  expect(byKind(d, 'plateau').detail).toContain(`${PLATEAU_MIN_RECORDS}개`)
})

test('영법 균형 — 가장 처지는 영법을 짚는다', () => {
  const d = diagnose([rec('free', 50, 3200), rec('breast', 50, 4500)], FREE50, 'M', BORN, TODAY)
  const b = byKind(d, 'balance')
  expect(b.status).toBe('focus')
  expect(b.title).toBe('평영 끌어올리기')
  expect(b.event).toEqual({ stroke: 'breast', distance: 50 })
})

test('영법 균형 — 차이가 기준보다 작으면 양호', () => {
  const d = diagnose([rec('free', 50, 3200), rec('back', 50, 4000)], FREE50, 'M', BORN, TODAY)
  const b = byKind(d, 'balance')
  expect(b.status).toBe('ok')
  expect(BALANCE_GAP).toBe(25)
})

test('영법 균형 — 성별 · 출생연도나 다른 영법이 없으면 묻는다', () => {
  const noProfile = diagnose([rec('free', 50, 3200), rec('breast', 50, 4500)], FREE50, null, null, TODAY)
  expect(byKind(noProfile, 'balance').status).toBe('need-data')
  expect(byKind(noProfile, 'balance').detail).toContain('성별')
  const oneStroke = diagnose([rec('free', 50, 3200)], FREE50, 'M', BORN, TODAY)
  expect(byKind(oneStroke, 'balance').status).toBe('need-data')
  expect(byKind(oneStroke, 'balance').detail).toContain('다른 영법')
})

test('우선순위 — 앞의 진단이 뒤를 이긴다', () => {
  // 후반 감속(focus)과 영법 균형(focus)이 함께면 후반 감속이 먼저.
  const records = [rec('free', 50, 3233), rec('free', 100, 7420), rec('breast', 50, 4500)]
  const d = diagnose(records, FREE50, 'M', BORN, TODAY)
  expect(byKind(d, 'balance').status).toBe('focus')
  expect(d.primary?.kind).toBe('endurance')

  // 앞의 셋이 focus 가 아니면 영법 균형이 주인공.
  const only = diagnose([rec('free', 50, 3200), rec('breast', 50, 4500)], FREE50, 'M', BORN, TODAY)
  expect(byKind(only, 'speed').status).toBe('ok')
  expect(only.primary?.kind).toBe('balance')
})
