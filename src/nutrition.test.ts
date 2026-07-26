import { describe, expect, test } from 'bun:test'
import {
  basalMetabolicRate,
  dailyDiet,
  servingKcal,
  servingsFor,
  sessionMinutes,
  swimKcal,
  SWIM_MET,
} from './nutrition'
import type { Body } from './types'

const body: Body = { heightCm: 172, weightKg: 68 }

describe('basalMetabolicRate · Mifflin-St Jeor', () => {
  test('남자 172cm 68kg 47세', () => {
    // 10×68 + 6.25×172 − 5×47 + 5 = 1525
    expect(basalMetabolicRate(body, '45-49', 'M')).toBeCloseTo(1525, 0)
  })

  test('여자는 같은 체격에서 166kcal 낮다', () => {
    const men = basalMetabolicRate(body, '45-49', 'M')
    const women = basalMetabolicRate(body, '45-49', 'F')
    expect(men - women).toBeCloseTo(166, 0)
  })

  test('나이가 많을수록 낮아진다', () => {
    expect(basalMetabolicRate(body, '65-69', 'M')).toBeLessThan(
      basalMetabolicRate(body, '25-29', 'M'),
    )
  })
})

describe('수영 소모', () => {
  test('2,000m 는 약 60분으로 본다', () => {
    expect(sessionMinutes(2000)).toBe(60)
  })

  test('MET 가 높을수록 많이 쓴다', () => {
    expect(swimKcal(body, 2000, SWIM_MET.hard)).toBeGreaterThan(
      swimKcal(body, 2000, SWIM_MET.easy),
    )
  })

  test('레이스페이스 2,000m 는 대략 600kcal 언저리다', () => {
    const value = swimKcal(body, 2000, SWIM_MET.hard)
    expect(value).toBeGreaterThan(500)
    expect(value).toBeLessThan(700)
  })
})

describe('servingsFor', () => {
  test('훈련일이 휴식일보다 곡류를 더 받는다 — 곡류가 완충 역할을 한다', () => {
    const rest = servingsFor(2100, 68, false)
    const training = servingsFor(2700, 68, true)
    expect(training.grain).toBeGreaterThan(rest.grain)
  })

  test('훈련일 단백질군이 더 많다', () => {
    expect(servingsFor(2700, 68, true).protein).toBeGreaterThan(
      servingsFor(2100, 68, false).protein,
    )
  })

  test('채소는 열량과 무관하게 고정이다 — 미량영양소 목적이다', () => {
    expect(servingsFor(1800, 55, false).vegetable).toBe(servingsFor(3200, 90, true).vegetable)
  })

  test('열량이 낮아도 최소 횟수 아래로 내려가지 않는다', () => {
    const tiny = servingsFor(900, 45, false)
    expect(tiny.grain).toBeGreaterThanOrEqual(2)
    expect(tiny.protein).toBeGreaterThanOrEqual(2)
  })

  test('식품군 열량 합이 목표 에너지에 가깝다', () => {
    const target = 2600
    const total = servingKcal(servingsFor(target, 70, true))
    expect(Math.abs(total - target)).toBeLessThan(160) // 곡류 1회(300kcal)의 반올림 오차 범위
  })
})

describe('dailyDiet', () => {
  const training = dailyDiet(body, '45-49', 'M', {
    training: true,
    meters: 2000,
    met: SWIM_MET.hard,
  })
  const rest = dailyDiet(body, '45-49', 'M', { training: false, meters: 0, met: 0 })

  test('훈련일이 휴식일보다 총 에너지가 크다', () => {
    expect(training.energy.total).toBeGreaterThan(rest.energy.total)
  })

  test('휴식일에는 수영 소모가 0 이다', () => {
    expect(rest.energy.swim).toBe(0)
  })

  test('끼니는 아침·점심·저녁·간식 넷이다', () => {
    expect(training.meals.map((meal) => meal.name)).toEqual(['아침', '점심', '저녁', '간식'])
  })

  test('0회짜리 항목은 끼니에 남기지 않는다', () => {
    for (const meal of training.meals) {
      for (const item of meal.items) expect(item.count).toBeGreaterThan(0)
    }
  })

  test('끼니에 나눈 곡류 합이 하루 횟수와 같다', () => {
    const spread = training.meals
      .flatMap((meal) => meal.items)
      .filter((item) => item.group === 'grain')
      .reduce((sum, item) => sum + item.count, 0)
    expect(spread).toBe(training.servings.grain)
  })

  test('훈련일에만 회복 타이밍 안내가 붙는다', () => {
    const trainingHints = training.meals.map((meal) => meal.hint).filter(Boolean)
    const restHints = rest.meals.map((meal) => meal.hint).filter(Boolean)
    expect(trainingHints.length).toBeGreaterThan(0)
    expect(restHints).toHaveLength(0)
  })

  test('단백질 목표는 체중 기반이고 훈련일이 높다', () => {
    expect(training.proteinTargetG).toBeCloseTo(68 * 1.6, 5)
    expect(rest.proteinTargetG).toBeCloseTo(68 * 1.2, 5)
  })
})
