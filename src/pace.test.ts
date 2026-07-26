import { describe, expect, test } from 'bun:test'
import {
  DIVE_ADVANTAGE_CS,
  formatTime,
  improvementPercent,
  parseTime,
  parseTimeInput,
  racePace25,
  splitTargets,
} from './pace'

describe('parseTime', () => {
  test('분:초.센티', () => expect(parseTime('1:23.45')).toBe(8345))
  test('분 없이', () => expect(parseTime('23.45')).toBe(2345))
  test('센티 없이', () => expect(parseTime('1:23')).toBe(8300))
  test('센티 한 자리는 십분의 일초', () => expect(parseTime('23.4')).toBe(2340))
  test('쉼표도 소수점으로', () => expect(parseTime('23,45')).toBe(2345))
  test('60초 이상은 거부', () => expect(parseTime('1:60.00')).toBeNull())
  test('빈 입력', () => expect(parseTime('  ')).toBeNull())
  test('형식 위반', () => expect(parseTime('1분 23초')).toBeNull())
})

describe('parseTimeInput · 숫자 키패드에는 콜론이 없다', () => {
  test('오른쪽부터 채운다 — 12345 는 1:23.45', () => {
    expect(parseTimeInput('12345')).toBe(8345)
  })
  test('네 자리는 분이 없다 — 2345 는 23.45', () => {
    expect(parseTimeInput('2345')).toBe(2345)
  })
  test('세 자리 — 130 은 1.30', () => expect(parseTimeInput('130')).toBe(130))
  test('두 자리 이하는 1/100초로만 채운다', () => {
    expect(parseTimeInput('45')).toBe(45)
    expect(parseTimeInput('5')).toBe(5)
  })
  test('여섯 자리 — 102345 는 10:23.45', () => {
    expect(parseTimeInput('102345')).toBe(62345)
  })

  test('콜론을 칠 수 있는 환경에서는 형식 입력도 받는다', () => {
    expect(parseTimeInput('1:23.45')).toBe(8345)
    expect(parseTimeInput('23.45')).toBe(2345)
  })

  test('숫자 사이 구분자는 무시한다 — 키패드의 마침표가 섞여도 된다', () => {
    expect(parseTimeInput('1.23.45')).toBe(8345)
  })

  test('60초 이상은 거부한다', () => expect(parseTimeInput('16045')).toBeNull())
  test('빈 입력과 과한 자릿수는 거부한다', () => {
    expect(parseTimeInput('  ')).toBeNull()
    expect(parseTimeInput('1234567')).toBeNull()
  })

  test('formatTime 과 왕복한다', () => {
    expect(formatTime(parseTimeInput('12345')!)).toBe('1:23.45')
    expect(formatTime(parseTimeInput('2345')!)).toBe('23.45')
  })
})

describe('formatTime', () => {
  test('1분 이상', () => expect(formatTime(8345)).toBe('1:23.45'))
  test('1분 미만', () => expect(formatTime(2345)).toBe('23.45'))
  test('센티 0 패딩', () => expect(formatTime(8305)).toBe('1:23.05'))
  test('parseTime 과 왕복', () => expect(formatTime(parseTime('1:05.07')!)).toBe('1:05.07'))
})

describe('racePace25', () => {
  test('100m 1:20.00 → 25m당 20.18', () => {
    expect(racePace25(8000, 100)).toBeCloseTo(2017.5, 1)
  })

  test('25m 목표 페이스는 대회 기록보다 다이빙 이득만큼 느리다', () => {
    expect(racePace25(1400, 25)).toBe(1400 + DIVE_ADVANTAGE_CS)
  })
})

describe('splitTargets', () => {
  test('구간 합이 목표기록과 일치한다', () => {
    const splits = splitTargets(8000, 100)
    expect(splits).toHaveLength(4)
    expect(splits.at(-1)).toBeCloseTo(8000, 6)
  })

  test('첫 구간만 다이빙 이득을 받아 나머지보다 빠르다', () => {
    const [first, second] = splitTargets(8000, 100)
    const firstLap = first!
    const secondLap = second! - first!
    expect(secondLap - firstLap).toBeCloseTo(DIVE_ADVANTAGE_CS, 6)
  })
})

describe('improvementPercent', () => {
  test('1:25 → 1:20 은 약 5.9% 단축', () => {
    expect(improvementPercent(8500, 8000)).toBeCloseTo(5.88, 2)
  })

  test('현재기록이 없으면 0', () => expect(improvementPercent(0, 8000)).toBe(0))
})
