/**
 * 식단 처방.
 *
 * 국가 기준 위에서만 계산한다 (ADR-0001). 메뉴를 지어내지 않고,
 * **에너지 필요량 → 식품군별 섭취횟수 → 식품군 대표식품**의 순서로만 내려간다.
 *
 * 출처
 * - 기초대사량: Mifflin-St Jeor 식. 체지방률을 아는 회원은 Katch-McArdle 식
 * - 식품군 1회 분량 열량과 대표식품: 한국인 영양소 섭취기준(KDRIs)의 식사구성안
 * - 훈련일 단백질·탄수화물 범위: ACSM/IOC 스포츠영양 권고
 * - 수영 소모 열량: MET × 3.5 × 체중(kg) / 200 × 분
 *
 * 이 화면은 신체 데이터를 요구하므로 **기기 밖으로 나가지 않는다** (ADR-0002).
 */
import type { AgeGroup, Body, Sex } from './types'
import { AGE_GROUP_MIDPOINT } from './types'

export type FoodGroup = 'grain' | 'protein' | 'vegetable' | 'fruit' | 'dairy' | 'fat'

/** 식사구성안이 정한 식품군별 1회 분량의 열량(kcal). */
const KCAL_PER_SERVING: Record<FoodGroup, number> = {
  grain: 300,
  protein: 100,
  vegetable: 15,
  fruit: 50,
  dairy: 125,
  fat: 45,
}

export const GROUP_LABEL: Record<FoodGroup, string> = {
  grain: '곡류',
  protein: '고기·생선·달걀·콩류',
  vegetable: '채소류',
  fruit: '과일류',
  dairy: '우유·유제품류',
  fat: '유지·당류',
}

/** 식품군별 대표식품과 1회 분량. 식사구성안 기준. */
export const REPRESENTATIVE: Record<FoodGroup, string[]> = {
  grain: ['밥 1공기(210g)', '식빵 2쪽(100g)', '국수 1대접(생면 90g)', '감자 2개(140g)', '고구마 1개(70g)'],
  protein: ['살코기 60g', '생선 1토막(60g)', '달걀 1개(60g)', '두부 1/5모(80g)', '콩 20g'],
  vegetable: ['나물 70g', '김치 40g', '버섯 30g', '미역·다시마 30g', '오이·당근 70g'],
  fruit: ['사과 1/2개(100g)', '귤 1개(100g)', '바나나 1개(100g)', '딸기 150g', '수박 150g'],
  dairy: ['우유 1컵(200mL)', '요구르트 1개(100g)', '치즈 1장(20g)'],
  fat: ['식용유 1작은술(5g)', '참기름 1작은술(5g)', '마요네즈 5g', '설탕 10g'],
}

/** 세션 성격별 수영 MET. 유산소·회복은 낮고 레이스페이스·스프린트는 높다. */
export const SWIM_MET = { easy: 6.0, moderate: 7.0, hard: 8.3 } as const

export interface EnergyBreakdown {
  bmr: number
  /** 훈련을 뺀 일상 활동까지 포함한 값 */
  baseline: number
  /** 그날 수영으로 더 쓰는 열량. 휴식일은 0. */
  swim: number
  total: number
}

/** 좌식~가벼운 활동 성인의 활동계수. 수영 소모는 여기 포함되지 않고 따로 더한다. */
const ACTIVITY_FACTOR = 1.4

/**
 * 체지방률이 성립하는 범위.
 *
 * 필수지방 아래(남 3% · 여 12%)는 생존 한계이고, 60% 를 넘는 값은 입력 실수다.
 * 벗어난 값은 **버리고 기존 식으로 돌아간다** — 이상한 숫자로 계산한 열량을
 * 그럴듯하게 보여주느니 덜 정확한 쪽이 낫다.
 */
const BODY_FAT_RANGE = { min: 3, max: 60 } as const

/**
 * 기초대사량.
 *
 * 체지방률을 알면 **Katch-McArdle**(`370 + 21.6 × 제지방량`)을 쓴다. 같은 키·체중
 * 이라도 근육이 많으면 더 쓰는데, 키·나이로 어림하는 식은 그 차이를 보지 못한다.
 *
 * 모르면 **Mifflin-St Jeor** 그대로다. 대부분의 회원은 체지방률을 모르고,
 * 모른다고 해서 식단을 못 받아서는 안 된다.
 */
export function basalMetabolicRate(body: Body, ageGroup: AgeGroup, sex: Sex): number {
  const fat = body.bodyFatPercent
  if (fat !== undefined && fat >= BODY_FAT_RANGE.min && fat <= BODY_FAT_RANGE.max) {
    const leanMassKg = body.weightKg * (1 - fat / 100)
    return 370 + 21.6 * leanMassKg
  }

  const age = AGE_GROUP_MIDPOINT[ageGroup]
  const base = 10 * body.weightKg + 6.25 * body.heightCm - 5 * age
  return sex === 'M' ? base + 5 : base - 161
}

/** 세션 거리로 시간을 어림한다. 마스터즈 기준 2,000m 에 약 60분. */
export function sessionMinutes(meters: number): number {
  return (meters / 2000) * 60
}

export function swimKcal(body: Body, meters: number, met: number): number {
  return ((met * 3.5 * body.weightKg) / 200) * sessionMinutes(meters)
}

export function dailyEnergy(
  body: Body,
  ageGroup: AgeGroup,
  sex: Sex,
  swim: number,
): EnergyBreakdown {
  const bmr = basalMetabolicRate(body, ageGroup, sex)
  const baseline = bmr * ACTIVITY_FACTOR
  return { bmr, baseline, swim, total: baseline + swim }
}

export interface Servings extends Record<FoodGroup, number> {}

/**
 * 에너지와 체중에서 식품군별 1일 섭취횟수를 뽑는다.
 *
 * 채소·과일·유지는 열량이 아니라 미량영양소·조리 목적이라 거의 고정이고,
 * 단백질군은 체중 기반 목표에서, 곡류는 **남은 열량**에서 나온다.
 * 그래서 곡류가 훈련일에 늘어나는 완충 역할을 한다.
 */
export function servingsFor(totalKcal: number, weightKg: number, training: boolean): Servings {
  // ACSM/IOC 권고 범위 안에서, 훈련일은 위쪽 휴식일은 아래쪽을 쓴다.
  const proteinTargetG = weightKg * (training ? 1.6 : 1.2)

  const vegetable = 7
  const fruit = training ? 3 : 2
  const dairy = training ? 2 : 1
  const fat = 4

  // 우유 1회에 단백질 약 6g, 곡류 1회에 약 6g 이 이미 들어 있다.
  const fromDairy = dairy * 6
  const proteinFromGroup = Math.max(0, proteinTargetG - fromDairy - 18)
  const protein = Math.max(2, Math.round(proteinFromGroup / 10))

  const fixedKcal =
    vegetable * KCAL_PER_SERVING.vegetable +
    fruit * KCAL_PER_SERVING.fruit +
    dairy * KCAL_PER_SERVING.dairy +
    fat * KCAL_PER_SERVING.fat +
    protein * KCAL_PER_SERVING.protein

  const grain = Math.max(2, Math.round((totalKcal - fixedKcal) / KCAL_PER_SERVING.grain))

  return { grain, protein, vegetable, fruit, dairy, fat }
}

export function servingKcal(servings: Servings): number {
  return (Object.keys(servings) as FoodGroup[]).reduce(
    (sum, group) => sum + servings[group] * KCAL_PER_SERVING[group],
    0,
  )
}

export interface Meal {
  name: string
  items: { group: FoodGroup; count: number }[]
  hint?: string
}

export interface DailyDiet {
  training: boolean
  energy: EnergyBreakdown
  servings: Servings
  meals: Meal[]
  proteinTargetG: number
}

/** 남은 횟수를 끼니에 나눠 담는다. 소수점을 남기지 않도록 마지막 끼니가 나머지를 받는다. */
function split(total: number, ratios: number[]): number[] {
  const parts = ratios.map((ratio) => Math.floor(total * ratio))
  const used = parts.reduce((sum, part) => sum + part, 0)
  parts[parts.length - 1] = (parts.at(-1) ?? 0) + (total - used)
  return parts
}

export function dailyDiet(
  body: Body,
  ageGroup: AgeGroup,
  sex: Sex,
  options: { training: boolean; meters: number; met: number },
): DailyDiet {
  const swim = options.training ? swimKcal(body, options.meters, options.met) : 0
  const energy = dailyEnergy(body, ageGroup, sex, swim)
  const servings = servingsFor(energy.total, body.weightKg, options.training)

  const grain = split(servings.grain, [0.3, 0.35, 0.35])
  const protein = split(servings.protein, [0.25, 0.375, 0.375])
  const vegetable = split(servings.vegetable, [0.28, 0.36, 0.36])

  const meals: Meal[] = [
    {
      name: '아침',
      items: [
        { group: 'grain', count: grain[0]! },
        { group: 'protein', count: protein[0]! },
        { group: 'vegetable', count: vegetable[0]! },
        { group: 'dairy', count: 1 },
      ],
      hint: options.training ? '훈련 2시간 전이면 곡류 위주로 먹고 지방은 줄이세요' : undefined,
    },
    {
      name: '점심',
      items: [
        { group: 'grain', count: grain[1]! },
        { group: 'protein', count: protein[1]! },
        { group: 'vegetable', count: vegetable[1]! },
      ],
    },
    {
      name: '저녁',
      items: [
        { group: 'grain', count: grain[2]! },
        { group: 'protein', count: protein[2]! },
        { group: 'vegetable', count: vegetable[2]! },
      ],
    },
    {
      name: '간식',
      items: [
        { group: 'fruit', count: servings.fruit },
        { group: 'dairy', count: Math.max(0, servings.dairy - 1) },
      ],
      hint: options.training
        ? '훈련 직후 30분 안에 과일과 우유를 함께 — 회복이 빨라집니다'
        : undefined,
    },
  ]

  return {
    training: options.training,
    energy,
    servings,
    meals: meals.map((meal) => ({ ...meal, items: meal.items.filter((item) => item.count > 0) })),
    proteinTargetG: body.weightKg * (options.training ? 1.6 : 1.2),
  }
}
