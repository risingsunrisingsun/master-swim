import { describe, expect, test } from 'bun:test'
import {
  composeTimeInput,
  DIVE_ADVANTAGE_CS,
  formatTime,
  improvementPercent,
  parseTime,
  racePace25,
  refoldTimeInput,
  splitTargets,
  splitTimeInput,
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

describe('composeTimeInput · 분 칸과 초 칸을 나눠 받는다', () => {
  test('100m — 분과 초를 합친다', () => {
    expect(composeTimeInput('1', '23.45')).toBe(8345)
    expect(composeTimeInput('2', '05.00')).toBe(12500)
  })

  test('50m — 분 칸이 비면 0분으로 본다', () => {
    expect(composeTimeInput('', '28.45')).toBe(2845)
    expect(composeTimeInput('', '28')).toBe(2800)
  })

  // 50m 를 1분 넘겨 도는 회원이 많다. 초 칸 하나만 주고 60초에서 막으면 못 넣는다.
  test('분이 0이면 60초 이상도 받는다', () => {
    expect(composeTimeInput('', '65.30')).toBe(6530)
    expect(formatTime(composeTimeInput('', '65.30')!)).toBe('1:05.30')
  })

  test('분이 있는데 초가 60 이상이면 거부한다 — 어느 쪽이 맞는지 알 수 없다', () => {
    expect(composeTimeInput('1', '65.30')).toBeNull()
  })

  test('초 칸이 비었거나 숫자가 아니면 null', () => {
    expect(composeTimeInput('1', '')).toBeNull()
    expect(composeTimeInput('1', 'abc')).toBeNull()
    expect(composeTimeInput('x', '23.45')).toBeNull()
    expect(composeTimeInput('', '0')).toBeNull()
  })
})

describe('splitTimeInput · composeTimeInput 의 역', () => {
  test('분이 있으면 두 칸으로 나눈다', () => {
    expect(splitTimeInput(8345)).toEqual({ minutes: '1', seconds: '23.45' })
  })

  test('1분 미만이면 분 칸은 빈다', () => {
    expect(splitTimeInput(2845)).toEqual({ minutes: '', seconds: '28.45' })
  })

  // 50m 화면에는 분 칸이 없다. 접어 내리지 않으면 1:05.30 이 5.30 이 된다.
  test('초만 모드면 분을 초에 접어 넣는다', () => {
    expect(splitTimeInput(6530, true)).toEqual({ minutes: '', seconds: '65.30' })
  })

  test('두 함수가 왕복한다', () => {
    for (const cs of [2845, 6530, 8345, 12500]) {
      const { minutes, seconds } = splitTimeInput(cs)
      expect(composeTimeInput(minutes, seconds)).toBe(cs)
      const flat = splitTimeInput(cs, true)
      expect(composeTimeInput(flat.minutes, flat.seconds)).toBe(cs)
    }
  })
})

describe('refoldTimeInput · 거리를 바꿔도 같은 기록을 가리킨다', () => {
  test('100m→50m 는 분을 초로 내린다', () => {
    expect(refoldTimeInput('1', '25.00', true)).toEqual({ minutes: '', seconds: '85.00' })
  })

  test('50m→100m 는 60초 이상을 분으로 올린다', () => {
    expect(refoldTimeInput('', '85.00', false)).toEqual({ minutes: '1', seconds: '25.00' })
  })

  // 이 조합은 `composeTimeInput` 이 거부한다. 분 칸만 비우면 남은 `85.00` 이
  // 1:25.00 으로 읽혀 회원이 뜻한 2:25.00 에서 1분이 조용히 사라진다.
  test('읽을 수 없는 입력에서 분만 지우지 않는다 — 초 칸이 다른 기록이 된다', () => {
    expect(refoldTimeInput('1', '85.00', true)).toEqual({ minutes: '', seconds: '' })
  })

  test('분 칸이 남아 있으면 손대지 않는다 — 회원이 직접 고칠 수 있다', () => {
    expect(refoldTimeInput('1', '85.00', false)).toEqual({ minutes: '1', seconds: '85.00' })
    expect(refoldTimeInput('x', '25.00', false)).toEqual({ minutes: 'x', seconds: '25.00' })
  })

  test('초 칸이 비어 있으면 숨는 김에 분 칸도 비운다', () => {
    expect(refoldTimeInput('1', '', true)).toEqual({ minutes: '', seconds: '' })
  })

  test('거리를 왕복해도 값이 보존된다', () => {
    for (const cs of [1320, 2845, 6530, 8500, 12500]) {
      const flat = splitTimeInput(cs, true)
      const up = refoldTimeInput(flat.minutes, flat.seconds, false)
      const down = refoldTimeInput(up.minutes, up.seconds, true)
      expect(composeTimeInput(up.minutes, up.seconds)).toBe(cs)
      expect(composeTimeInput(down.minutes, down.seconds)).toBe(cs)
    }
  })

  // 25m 기록은 분이 붙을 일이 없다. 초 칸만으로 왕복해야 한다.
  test('25m 짧은 기록', () => {
    expect(refoldTimeInput('', '13.20', true)).toEqual({ minutes: '', seconds: '13.20' })
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
