/**
 * 국내 마스터즈 기록 분포.
 *
 * 마이랭킹의 "기록 분포" 화면 캡처에서 **눈으로 읽은 히스토그램**이다. 백분위 표를
 * 직접 받은 것이 아니므로 다음 한계를 안고 있다.
 *
 * - `counts` 는 그래프에서 읽은 추정치다. 340건과 370건을 구분할 수 없다.
 *   백분위는 누적합으로 계산되므로 개별 오차는 상당히 상쇄되지만, 중앙값 기준
 *   ±0.5~1초, 꼬리는 그보다 큰 오차를 가정해야 한다.
 * - `total` 은 화면에 표시된 값이라 정확하다. 백분위는 비율만 쓰므로
 *   `counts` 의 절대 크기가 아니라 **모양**이 결과를 정한다.
 * - 원본은 **연대**(20대·30대…)로 묶여 있다. 이 앱의 5세 연령부는 연대로 접어서 쓴다.
 *
 * 값이 틀렸다고 판단되면 이 파일의 배열만 고치면 된다 — 계산·화면·테스트는
 * 손대지 않는다.
 *
 * ## 아직 의심스러운 곳
 *
 * 50대 세 분포(`M/50/back`, `F/50/back`, `F/50/free`)는 그래프 왼쪽에 넓은 평지가
 * 있어 빠른 꼬리가 무겁게 읽혔다. 그 결과 **상위 5% 커트라인이 20~40대보다 빠르게**
 * 나온다. 중앙값은 연대 순서를 지키므로(테스트로 고정) 실사용에 큰 지장은 없지만,
 * 상위 5% 부근 표시는 이 세 분포에서 신뢰도가 낮다. 원본을 다시 확인해야 한다.
 *
 * 출처: 마이랭킹(myranking.co.kr) 기록 분포 화면. 자동 수집하지 않았다 —
 * `robots.txt` 가 검색엔진 넷 외 전체를 차단한다.
 */
import type { Distance, Sex, Stroke } from './types'

/** 원본이 쓰는 연령 묶음. 5세 연령부보다 거칠다. */
export type Decade = 20 | 30 | 40 | 50 | 60

export interface Distribution {
  sex: Sex
  decade: Decade
  stroke: Stroke
  distance: Distance
  /** 화면에 표시된 표본 수 */
  total: number
  /** 첫 구간의 기록(centisecond) */
  startCs: number
  /** 구간 폭. 원본이 1초 단위다. */
  binCs: number
  /** `startCs` 부터 `binCs` 씩 올라가는 구간별 건수(추정) */
  counts: readonly number[]
}

const S = 100 // 1초 = 100 centisecond

/* eslint-disable prettier/prettier */
export const DISTRIBUTIONS: readonly Distribution[] = [
  // ── 자유형 50m · 남자 ────────────────────────────────────────────────
  {
    sex: 'M', decade: 20, stroke: 'free', distance: 50, total: 9957, startCs: 23 * S, binCs: S,
    counts: [
      10, 80, 320, 630, 870, 1060, 1090, 1060, 930, 790, 600, 560, 450, 390, 350, 310, 250, 170,
      160, 140, 150, 90, 80, 70, 55, 50, 45, 35, 40, 30, 25, 22, 20, 18, 16, 15, 14, 13, 12, 11,
      10, 10, 10, 10,
    ],
  },
  {
    sex: 'M', decade: 30, stroke: 'free', distance: 50, total: 15112, startCs: 23 * S, binCs: S,
    counts: [
      15, 40, 70, 110, 320, 890, 1180, 1460, 1520, 1500, 1490, 1330, 1170, 950, 700, 530, 420,
      250, 230, 200, 160, 120, 105, 95, 70, 60, 50, 40, 35, 30, 30, 28, 25, 22, 20, 18, 16, 15,
      14, 20,
    ],
  },
  {
    sex: 'M', decade: 40, stroke: 'free', distance: 50, total: 14642, startCs: 25 * S, binCs: S,
    counts: [
      40, 110, 370, 620, 850, 1200, 1350, 1510, 1420, 1370, 1250, 1000, 830, 650, 500, 330, 300,
      220, 190, 150, 110, 100, 90, 70, 60, 50, 45, 40, 35, 30, 28, 25, 22, 20, 18, 16, 15,
    ],
  },
  {
    sex: 'M', decade: 50, stroke: 'free', distance: 50, total: 6984, startCs: 23 * S, binCs: S,
    counts: [
      20, 65, 120, 132, 125, 135, 275, 395, 530, 565, 570, 555, 585, 480, 495, 415, 290, 275,
      215, 145, 130, 80, 90, 50, 45, 35, 42, 32, 25, 28, 25, 22, 15, 18, 14, 15,
    ],
  },
  {
    sex: 'M', decade: 60, stroke: 'free', distance: 50, total: 680, startCs: 24 * S, binCs: S,
    counts: [
      2, 7, 6, 3, 4, 3, 24, 17, 26, 47, 45, 62, 48, 39, 35, 41, 57, 44, 25, 15, 21, 23, 16, 11,
      8, 10, 8, 10, 5, 6, 2, 2, 3, 2, 2, 2,
    ],
  },

  // ── 자유형 50m · 여자 ────────────────────────────────────────────────
  {
    sex: 'F', decade: 20, stroke: 'free', distance: 50, total: 6246, startCs: 25 * S, binCs: S,
    counts: [
      3, 4, 6, 30, 135, 275, 325, 370, 385, 365, 360, 355, 370, 385, 340, 335, 340, 340, 275,
      240, 220, 195, 185, 130, 120, 115, 130, 85, 70, 68, 66, 55, 45, 38, 30, 28, 30, 30, 20,
      12, 10, 14, 12, 10, 8, 8, 8, 10, 8,
    ],
  },
  {
    sex: 'F', decade: 30, stroke: 'free', distance: 50, total: 10088, startCs: 27 * S, binCs: S,
    counts: [
      10, 25, 100, 175, 200, 300, 470, 610, 710, 715, 690, 720, 725, 705, 620, 520, 510, 360,
      355, 300, 260, 225, 175, 145, 125, 110, 72, 70, 58, 45, 40, 42, 45, 35, 30, 28, 25, 22,
      20, 18, 16, 15, 14, 12, 10,
    ],
  },
  {
    sex: 'F', decade: 40, stroke: 'free', distance: 50, total: 9285, startCs: 28 * S, binCs: S,
    counts: [
      8, 18, 25, 40, 70, 195, 320, 350, 355, 440, 545, 630, 680, 730, 710, 655, 615, 500, 520,
      365, 350, 305, 240, 165, 165, 115, 90, 78, 68, 52, 45, 38, 32, 28, 22, 18, 8, 6, 20, 12,
      10, 12, 10, 8, 6, 8,
    ],
  },
  {
    sex: 'F', decade: 50, stroke: 'free', distance: 50, total: 4716, startCs: 26 * S, binCs: S,
    counts: [
      8, 30, 78, 68, 68, 60, 68, 82, 112, 155, 182, 242, 248, 302, 258, 310, 292, 264, 236, 248,
      205, 182, 160, 140, 118, 112, 78, 70, 58, 48, 42, 34, 16, 28, 24, 12, 18, 10, 10, 12, 14,
      6,
    ],
  },
  {
    sex: 'F', decade: 60, stroke: 'free', distance: 50, total: 558, startCs: 30 * S, binCs: S,
    counts: [
      2, 4, 3, 2, 2, 3, 12, 11, 15, 26, 37, 30, 30, 31, 32, 36, 37, 33, 33, 18, 21, 12, 11, 17,
      12, 14, 21, 14, 10, 1, 7, 3, 2, 1, 5, 4, 1, 3, 1,
    ],
  },

  // ── 배영 50m · 남자 ──────────────────────────────────────────────────
  {
    sex: 'M', decade: 20, stroke: 'back', distance: 50, total: 2798, startCs: 27 * S, binCs: S,
    counts: [
      6, 32, 70, 122, 170, 200, 186, 202, 190, 170, 202, 172, 168, 140, 120, 113, 78, 64, 45,
      47, 44, 26, 25, 25, 15, 14, 13, 6, 10, 8, 9, 5, 9, 4, 6, 8, 6, 4, 4, 4, 4,
    ],
  },
  {
    sex: 'M', decade: 30, stroke: 'back', distance: 50, total: 4404, startCs: 27 * S, binCs: S,
    counts: [
      3, 4, 12, 42, 85, 143, 275, 253, 233, 265, 288, 297, 292, 300, 273, 235, 216, 175, 148,
      135, 110, 118, 78, 90, 50, 42, 40, 25, 24, 20, 12, 15, 12, 11, 10, 12, 8, 6, 5, 6, 7,
    ],
  },
  {
    sex: 'M', decade: 40, stroke: 'back', distance: 50, total: 4998, startCs: 27 * S, binCs: S,
    counts: [
      3, 5, 10, 25, 38, 42, 122, 130, 133, 135, 230, 268, 348, 337, 355, 358, 348, 322, 328,
      250, 215, 178, 155, 158, 110, 78, 72, 55, 50, 48, 38, 32, 28, 25, 18, 12, 14, 12, 13, 6,
      6, 6, 5,
    ],
  },
  {
    sex: 'M', decade: 50, stroke: 'back', distance: 50, total: 3360, startCs: 26 * S, binCs: S,
    counts: [
      28, 43, 51, 53, 40, 53, 56, 51, 50, 53, 74, 110, 166, 172, 185, 179, 204, 208, 188, 199,
      178, 156, 128, 124, 92, 86, 66, 60, 48, 49, 34, 17, 18, 17, 14, 18, 9, 12, 8, 5,
    ],
  },
  {
    sex: 'M', decade: 60, stroke: 'back', distance: 50, total: 333, startCs: 29 * S, binCs: S,
    counts: [
      2, 2, 5, 2, 2, 1, 4, 7, 8, 6, 7, 19, 18, 18, 27, 22, 10, 18, 18, 7, 17, 20, 12, 10, 7,
      10, 10, 11, 7, 8, 3, 3, 2, 4, 1, 4,
    ],
  },

  // ── 배영 50m · 여자 ──────────────────────────────────────────────────
  {
    sex: 'F', decade: 20, stroke: 'back', distance: 50, total: 3073, startCs: 31 * S, binCs: S,
    counts: [
      2, 16, 48, 78, 138, 124, 150, 168, 134, 158, 134, 133, 138, 140, 146, 147, 138, 130, 110,
      97, 86, 103, 110, 76, 68, 52, 41, 47, 40, 40, 2, 27, 24, 20, 16, 15, 13, 11, 14, 12, 6,
      6, 6, 5, 4,
    ],
  },
  {
    sex: 'F', decade: 30, stroke: 'back', distance: 50, total: 4849, startCs: 30 * S, binCs: S,
    counts: [
      2, 4, 9, 15, 22, 75, 68, 80, 103, 155, 168, 208, 238, 285, 272, 283, 276, 281, 246, 271,
      212, 224, 203, 168, 148, 141, 93, 112, 62, 62, 58, 45, 40, 32, 30, 20, 24, 22, 8, 9, 10,
      8, 9, 4, 5, 3,
    ],
  },
  {
    sex: 'F', decade: 40, stroke: 'back', distance: 50, total: 5272, startCs: 30 * S, binCs: S,
    counts: [
      3, 3, 4, 3, 4, 8, 12, 16, 58, 90, 112, 135, 160, 195, 248, 255, 295, 330, 315, 305, 310,
      288, 262, 235, 248, 195, 190, 165, 138, 100, 92, 78, 60, 48, 46, 50, 38, 32, 18, 16, 15,
      16, 10, 12, 14, 8, 6, 8,
    ],
  },
  {
    sex: 'F', decade: 50, stroke: 'back', distance: 50, total: 3085, startCs: 28 * S, binCs: S,
    counts: [
      5, 16, 14, 22, 34, 50, 44, 32, 30, 27, 30, 26, 44, 54, 80, 98, 85, 102, 138, 144, 138,
      138, 134, 158, 172, 156, 145, 132, 102, 110, 84, 62, 72, 52, 50, 56, 36, 24, 22, 24, 26,
      15, 14, 11, 9, 8, 6,
    ],
  },
  {
    sex: 'F', decade: 60, stroke: 'back', distance: 50, total: 366, startCs: 32 * S, binCs: S,
    counts: [
      2, 1, 3, 2, 4, 2, 3, 1, 1, 10, 9, 10, 12, 14, 8, 16, 11, 21, 24, 30, 18, 20, 13, 8, 12,
      15, 10, 7, 7, 6, 8, 7, 7, 6, 2, 5, 2, 2,
    ],
  },
]
/* eslint-enable prettier/prettier */

/** 5세 연령부를 원본의 연대로 접는다. 70대 이상은 60대 분포를 쓴다. */
export function decadeOf(ageGroup: string): Decade {
  const start = Number(ageGroup.slice(0, 2))
  if (start < 30) return 20
  if (start < 40) return 30
  if (start < 50) return 40
  if (start < 60) return 50
  return 60
}

export function findDistribution(
  stroke: Stroke,
  distance: Distance,
  sex: Sex,
  decade: Decade,
): Distribution | undefined {
  return DISTRIBUTIONS.find(
    (entry) =>
      entry.stroke === stroke &&
      entry.distance === distance &&
      entry.sex === sex &&
      entry.decade === decade,
  )
}

const totalOf = (dist: Distribution): number =>
  dist.counts.reduce((total, count) => total + count, 0)

/**
 * 이 기록이 **이긴** 사람의 비율(0~100). 클수록 빠르다.
 *
 * 이름을 이렇게 둔 이유가 있다 — "백분위"라고만 부르면 방향이 뒤집힌다.
 * 90 을 이긴 사람은 **상위 10%** 다. 화면 라벨은 `100 − 이 값`을 쓴다.
 *
 * 구간 안에서는 균등분포를 가정해 선형보간한다. 1초 폭이라 이 가정의 오차는
 * 그래프 읽기 오차보다 작다.
 */
export function percentileBeaten(timeCs: number, dist: Distribution): number {
  const sum = totalOf(dist)
  if (sum === 0) return 0

  let faster = 0 // 이 기록보다 빠른 쪽의 누적
  for (let i = 0; i < dist.counts.length; i++) {
    const binStart = dist.startCs + i * dist.binCs
    const binEnd = binStart + dist.binCs
    const count = dist.counts[i]!

    if (timeCs >= binEnd) {
      faster += count
      continue
    }
    if (timeCs <= binStart) break

    faster += count * ((timeCs - binStart) / dist.binCs)
    break
  }

  return Math.max(0, Math.min(100, (1 - faster / sum) * 100))
}

/**
 * 상위 몇 %의 커트라인 기록. `topPercent = 5` 면 가장 빠른 5% 의 경계다.
 * 값이 작을수록(빠를수록) 상위이므로 빠른 쪽에서부터 센다.
 */
export function timeForTopPercent(topPercent: number, dist: Distribution): number {
  const wanted = totalOf(dist) * (topPercent / 100)

  let cumulative = 0
  for (let i = 0; i < dist.counts.length; i++) {
    const count = dist.counts[i]!
    if (cumulative + count >= wanted) {
      const within = count === 0 ? 0 : (wanted - cumulative) / count
      return dist.startCs + (i + within) * dist.binCs
    }
    cumulative += count
  }

  return dist.startCs + dist.counts.length * dist.binCs
}
