/**
 * 훈련방법 카탈로그.
 *
 * 세트를 수백 개 적어두는 대신 방법 20개에 등급별 파라미터를 붙인다. 사용자의 목표
 * 페이스가 대입되면 각자 다른 실제 세트가 나온다 — 기능 1(주간 플랜)과 기능 4(카탈로그
 * 열람)는 이 한 벌을 공유한다.
 *
 * 지원 종목이 25/50/100 뿐이라 사용자는 전원 스프린터다. 그래서 25m 단수로에서
 * 비중이 큰 벽 구간(스타트·턴·언더워터)이 카탈로그의 한 축을 이룬다.
 */
import { formatTime } from './pace'
import type { Level } from './types'

export type MethodCategory =
  | 'racePace' // 목표 페이스 고착
  | 'speed' // 최대 속도·파워
  | 'wall' // 스타트·턴·언더워터
  | 'technique' // 기술·스트로크 길이
  | 'aerobic' // 기초 지속력·회복
  | 'test' // 측정
  | 'dryland' // 육상

/** 페이스 대신 노력도로 지시하는 세트. 지정되면 목표 페이스를 표시하지 않는다. */
export type Effort = 'max' | 'easy' | 'technique'

export interface PoolSpec {
  reps: number
  /** 반복 거리(m). 0 이면 '목표 종목 거리 그대로'. */
  distance: number
  /** 인터벌 휴식(centisecond). null 이면 완전 회복 — 시계로 재지 않는다. */
  restCs: number | null
  /** 목표 페이스 대비 보정(centisecond). 음수면 목표보다 빠르게. */
  paceOffsetCs: number
  effort?: Effort
  note?: string
}

export interface DrylandSpec {
  sets: number
  /** "12~15회" · "30초" 처럼 단위가 섞이므로 문자열로 둔다. */
  reps: string
  note?: string
}

interface MethodBase {
  id: string
  name: string
  category: MethodCategory
  /** 무엇을 얻으려고 하는가. */
  purpose: string
  /** 왜 그것이 얻어지는가. */
  principle: string
  /** 잘못 쓰면 무엇이 망가지는가. */
  cautions: string[]
}

/** `levels` 의 null 은 그 등급에 처방하지 않는다는 뜻이다. */
export type TrainingMethod = MethodBase &
  (
    | { kind: 'pool'; levels: Record<Level, PoolSpec | null> }
    | { kind: 'dryland'; levels: Record<Level, DrylandSpec | null> }
  )

const SECONDS = 100

// ---------------------------------------------------------------------------
// 수영장
// ---------------------------------------------------------------------------

const POOL_METHODS: TrainingMethod[] = [
  {
    kind: 'pool',
    id: 'rp25',
    name: '레이스페이스 25',
    category: 'racePace',
    purpose: '목표 페이스의 동작 패턴을 몸에 고착시킨다.',
    principle:
      '목표기록을 25m 단위로 쪼개면 목표 페이스를 짧은 반복으로 여러 번 경험할 수 있다. 두 번 연속 페이스를 놓치면 그 자리에서 끝낸다 — 실패는 실수가 아니라 오늘의 한계가 어디였는지 알려주는 측정값이다.',
    cautions: [
      '페이스를 놓치면서 개수를 채우면 목표와 다른 동작을 익히게 된다. 개수보다 페이스가 먼저다.',
      '실패한 반복 번호를 기록해 둔다. 목표가 이른지 판단할 유일한 증거다.',
    ],
    levels: {
      beginner: { reps: 12, distance: 25, restCs: 20 * SECONDS, paceOffsetCs: 0 },
      intermediate: { reps: 16, distance: 25, restCs: 15 * SECONDS, paceOffsetCs: 0 },
      advanced: { reps: 20, distance: 25, restCs: 12 * SECONDS, paceOffsetCs: 0 },
      elite: { reps: 24, distance: 25, restCs: 10 * SECONDS, paceOffsetCs: 0 },
    },
  },
  {
    kind: 'pool',
    id: 'rp50',
    name: '레이스페이스 50',
    category: 'racePace',
    purpose: '목표 페이스를 턴 하나를 포함한 길이로 이어 붙인다.',
    principle:
      '25m 반복은 벽 사이 구간만 다룬다. 50m 로 늘리면 턴 이후 페이스가 유지되는지가 드러난다 — 25m 단수로 100m 는 턴이 세 개라 여기서 무너지는 경우가 많다.',
    cautions: [
      '후반 25m 가 전반보다 1초 이상 느려지면 지속력이 아니라 턴과 브레이크아웃 문제일 가능성이 크다.',
    ],
    levels: {
      beginner: { reps: 6, distance: 50, restCs: 30 * SECONDS, paceOffsetCs: 0 },
      intermediate: { reps: 8, distance: 50, restCs: 25 * SECONDS, paceOffsetCs: 0 },
      advanced: { reps: 10, distance: 50, restCs: 20 * SECONDS, paceOffsetCs: 0 },
      elite: { reps: 12, distance: 50, restCs: 15 * SECONDS, paceOffsetCs: 0 },
    },
  },
  {
    kind: 'pool',
    id: 'broken',
    name: '브로큰 스윔',
    category: 'racePace',
    purpose: '목표보다 빠른 페이스를 미리 경험시킨다.',
    principle:
      '목표 거리를 25m 마다 끊어 짧게 쉬면 한 번도 내본 적 없는 페이스를 낼 수 있다. 합계가 목표보다 빠르면 그 속도 자체는 이미 가능하다는 뜻이고, 남은 과제는 쉬지 않고 이어 붙이는 것이 된다.',
    cautions: [
      '휴식이 길어지면 그냥 빠른 25m 반복이 된다. 쉬는 시간을 정확히 지킨다.',
      '합계로만 판정한다. 구간 하나가 빠른 것은 의미가 없다.',
    ],
    levels: {
      beginner: {
        reps: 2,
        distance: 100,
        restCs: 10 * SECONDS,
        paceOffsetCs: -30,
        note: '25m 마다 끊어 쉬고 4구간 합계로 판정',
      },
      intermediate: {
        reps: 3,
        distance: 100,
        restCs: 8 * SECONDS,
        paceOffsetCs: -30,
        note: '25m 마다 끊어 쉬고 4구간 합계로 판정',
      },
      advanced: {
        reps: 4,
        distance: 100,
        restCs: 6 * SECONDS,
        paceOffsetCs: -30,
        note: '25m 마다 끊어 쉬고 4구간 합계로 판정',
      },
      elite: {
        reps: 5,
        distance: 100,
        restCs: 5 * SECONDS,
        paceOffsetCs: -30,
        note: '25m 마다 끊어 쉬고 4구간 합계로 판정',
      },
    },
  },
  {
    kind: 'pool',
    id: 'descending',
    name: '데센딩',
    category: 'racePace',
    purpose: '페이스를 의도한 대로 올리는 감각을 만든다.',
    principle:
      '같은 거리를 반복하면서 매번 조금씩 빠르게 간다. 마스터즈에서 가장 흔한 실패는 페이스 감각 없이 처음부터 전력으로 나가는 것인데, 이 세트는 속도를 스스로 배분하게 만든다.',
    cautions: [
      '마지막 반복만 빠르면 데센딩이 아니다. 매 반복이 앞보다 빨라야 한다.',
      '1번을 너무 빠르게 시작하면 세트가 성립하지 않는다.',
    ],
    levels: {
      beginner: {
        reps: 4,
        distance: 50,
        restCs: 30 * SECONDS,
        paceOffsetCs: 0,
        note: '1번은 목표 페이스 +2초, 마지막은 목표 페이스',
      },
      intermediate: {
        reps: 8,
        distance: 50,
        restCs: 25 * SECONDS,
        paceOffsetCs: 0,
        note: '4개씩 두 묶음. 각 묶음의 마지막이 목표 페이스',
      },
      advanced: {
        reps: 12,
        distance: 50,
        restCs: 20 * SECONDS,
        paceOffsetCs: 0,
        note: '4개씩 세 묶음. 묶음마다 시작 페이스를 당긴다',
      },
      elite: {
        reps: 16,
        distance: 50,
        restCs: 15 * SECONDS,
        paceOffsetCs: 0,
        note: '4개씩 네 묶음. 마지막 묶음은 전부 목표 페이스 이하',
      },
    },
  },
  {
    kind: 'pool',
    id: 'negative',
    name: '네거티브 스플릿',
    category: 'racePace',
    purpose: '후반에 무너지지 않는 레이스 배분을 익힌다.',
    principle:
      '후반 절반을 전반보다 빠르게 간다. 전력으로 나갔다가 후반에 멈추는 패턴을 물리적으로 불가능하게 만들어, 몸이 스스로 초반을 아끼게 한다.',
    cautions: [
      '전반을 지나치게 느리게 가면 조건은 충족하지만 아무것도 배우지 못한다. 전반은 목표 페이스 +1초 안쪽으로 둔다.',
    ],
    levels: {
      beginner: { reps: 2, distance: 100, restCs: 60 * SECONDS, paceOffsetCs: 0 },
      intermediate: { reps: 3, distance: 100, restCs: 60 * SECONDS, paceOffsetCs: 0 },
      advanced: { reps: 4, distance: 100, restCs: 45 * SECONDS, paceOffsetCs: 0 },
      elite: { reps: 6, distance: 100, restCs: 45 * SECONDS, paceOffsetCs: 0 },
    },
  },
  {
    kind: 'pool',
    id: 'lactate-tolerance',
    name: '젖산 내성',
    category: 'speed',
    purpose: '후반 근육이 굳는 구간을 버티는 능력을 올린다.',
    principle:
      '목표보다 빠른 속도로 짧게 가고 충분히 회복한 뒤 다시 간다. 회복이 불충분하면 훈련 자극이 아니라 손상만 남으므로 휴식이 세트의 일부다.',
    cautions: [
      '초급에는 처방하지 않는다. 기술이 자리 잡기 전에 최대 노력을 반복하면 잘못된 동작이 고착된다.',
      '주 1회를 넘기지 않는다. 회복에 48시간이 필요하다.',
      '심혈관 위험인자가 있으면 최대 노력 세트를 건너뛴다.',
    ],
    levels: {
      beginner: null,
      intermediate: {
        reps: 3,
        distance: 50,
        restCs: null,
        paceOffsetCs: 0,
        effort: 'max',
        note: '반복 사이 완전 회복 3분',
      },
      advanced: {
        reps: 4,
        distance: 50,
        restCs: null,
        paceOffsetCs: 0,
        effort: 'max',
        note: '반복 사이 완전 회복 3분',
      },
      elite: {
        reps: 6,
        distance: 50,
        restCs: null,
        paceOffsetCs: 0,
        effort: 'max',
        note: '반복 사이 완전 회복 3분',
      },
    },
  },
  {
    kind: 'pool',
    id: 'sprint-power',
    name: '스프린트 파워',
    category: 'speed',
    purpose: '최고 속도의 천장을 올린다.',
    principle:
      '목표 페이스는 최고 속도의 몇 퍼센트냐로 결정된다. 천장이 낮으면 아무리 지속력을 키워도 목표에 닿지 못하므로, 완전히 회복한 상태에서 짧게 전력으로 간다.',
    cautions: [
      '지치면 그만둔다. 피로한 상태의 전력 질주는 속도를 올리지 않고 느린 동작을 익히게 한다.',
      '반드시 충분한 워밍업 뒤에 한다.',
    ],
    levels: {
      beginner: { reps: 4, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'max', note: '완전 회복 2분' },
      intermediate: { reps: 6, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'max', note: '완전 회복 2분' },
      advanced: { reps: 8, distance: 25, restCs: null, paceOffsetCs: 0, effort: 'max', note: '완전 회복 2~3분' },
      elite: { reps: 10, distance: 25, restCs: null, paceOffsetCs: 0, effort: 'max', note: '완전 회복 2~3분' },
    },
  },
  {
    kind: 'pool',
    id: 'underwater',
    name: '언더워터 · 브레이크아웃',
    category: 'wall',
    purpose: '25m 종목 기록의 3할을 좌우하는 구간을 훈련한다.',
    principle:
      '잠영 속도는 수면 스트로크보다 빠르다. 25m 단수로에서는 벽마다 이 구간이 생기므로, 잠영 거리와 브레이크아웃 타이밍이 스트로크 개선보다 큰 이득을 줄 때가 많다.',
    cautions: [
      '과호흡 뒤 잠영은 물속 의식 소실을 일으킬 수 있다. 숨을 참는 시간이나 거리를 겨루지 않는다.',
      '혼자 훈련하지 않는다. 반드시 보는 사람이 있어야 한다.',
      '어지럽거나 시야가 좁아지면 즉시 중단한다.',
    ],
    levels: {
      beginner: { reps: 4, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'technique', note: '잠영 7m 목표' },
      intermediate: { reps: 6, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'technique', note: '잠영 10m 목표' },
      advanced: { reps: 8, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'technique', note: '잠영 12m 목표' },
      elite: { reps: 10, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'technique', note: '잠영 15m 규정 한계까지' },
    },
  },
  {
    kind: 'pool',
    id: 'turns',
    name: '턴 반복',
    category: 'wall',
    purpose: '100m 에 세 번 있는 턴에서 새는 시간을 줄인다.',
    principle:
      '턴은 진입 5m 와 이탈 5m 를 합쳐 판정해야 의미가 있다. 벽을 빨리 차고도 진입에서 속도를 죽이면 총합은 그대로다.',
    cautions: [
      '턴 자체의 속도보다 진입 속도 유지가 먼저다. 벽 앞에서 스트로크를 멈추는 습관이 가장 큰 손실이다.',
      '평영·접영 턴은 양손 터치 규정을 지킨 상태로 연습한다. 연습에서 어긴 것은 대회에서 실격이 된다.',
    ],
    levels: {
      beginner: { reps: 6, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'technique', note: '벽 5m 전 ~ 이탈 10m 구간만' },
      intermediate: { reps: 8, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'technique', note: '진입 속도를 유지한 채 턴' },
      advanced: { reps: 12, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'technique', note: '진입 5m 를 레이스 페이스로' },
      elite: { reps: 16, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'technique', note: '진입·이탈 모두 레이스 페이스로' },
    },
  },
  {
    kind: 'pool',
    id: 'starts',
    name: '스타트 반복',
    category: 'wall',
    purpose: '기록에서 가장 값싸게 줄어드는 0.5초를 가져온다.',
    principle:
      '다이빙과 입수 자세는 체력과 거의 무관하게 개선된다. 25m·50m 종목에서는 이 한 번이 전체 기록의 큰 몫을 차지한다.',
    cautions: [
      '수심이 얕은 레인에서 다이빙하지 않는다.',
      '어깨나 목에 통증이 있으면 입수 자세부터 어긋난다. 통증 상태로 반복하지 않는다.',
    ],
    levels: {
      beginner: { reps: 4, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'max', note: '입수 자세 위주, 15m 통과' },
      intermediate: { reps: 6, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'max', note: '15m 통과 시간 기록' },
      advanced: { reps: 8, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'max', note: '반응 + 15m 통과 시간 기록' },
      elite: { reps: 10, distance: 15, restCs: null, paceOffsetCs: 0, effort: 'max', note: '신호 반응까지 포함해 측정' },
    },
  },
  {
    kind: 'pool',
    id: 'dps',
    name: 'DPS · 스트로크 수 제한',
    category: 'technique',
    purpose: '같은 속도를 더 적은 스트로크로 낸다.',
    principle:
      '속도는 스트로크 길이 × 회전수다. 회전수만 올려 속도를 내면 후반에 반드시 무너지므로, 먼저 길이의 상한을 올려둔다. 윙스팬이 길이의 한계를 규정하지만 대부분은 그 한계에 한참 못 미친다.',
    cautions: [
      '스트로크 수를 줄이려고 활강 시간을 늘리면 속도가 떨어진다. 시간과 스트로크 수를 함께 본다.',
      '평영은 규정상 스트로크 수 조절 폭이 작다. 자유형·배영에서 먼저 적용한다.',
    ],
    levels: {
      beginner: { reps: 4, distance: 25, restCs: null, paceOffsetCs: 0, effort: 'technique', note: '평소 스트로크 수 −1회로 25m' },
      intermediate: { reps: 6, distance: 50, restCs: 30 * SECONDS, paceOffsetCs: 0, effort: 'technique', note: '평소 −2회, 시간도 함께 기록' },
      advanced: { reps: 8, distance: 50, restCs: 25 * SECONDS, paceOffsetCs: 0, effort: 'technique', note: '−2회를 유지한 채 목표 페이스 +2초' },
      elite: { reps: 10, distance: 50, restCs: 20 * SECONDS, paceOffsetCs: 0, effort: 'technique', note: '−2회를 유지한 채 목표 페이스' },
    },
  },
  {
    kind: 'pool',
    id: 'drills',
    name: '테크닉 드릴',
    category: 'technique',
    purpose: '동작을 쪼개서 약한 부분만 고친다.',
    principle:
      '전체 동작으로는 어디가 잘못됐는지 느끼기 어렵다. 한팔·캐치업·스컬링처럼 일부만 남기면 그 부분의 감각이 분리되어 드러난다.',
    cautions: [
      '드릴은 그 자체가 목적이 아니다. 드릴 뒤에 반드시 전체 동작으로 25m 를 붙여 옮겨졌는지 확인한다.',
      '잘못된 자세로 반복하는 드릴은 잘못된 자세를 강화한다. 확신이 없으면 코치에게 한 번 보여준다.',
    ],
    levels: {
      beginner: { reps: 8, distance: 25, restCs: 20 * SECONDS, paceOffsetCs: 0, effort: 'technique', note: '캐치업 · 한팔 위주' },
      intermediate: { reps: 12, distance: 25, restCs: 20 * SECONDS, paceOffsetCs: 0, effort: 'technique', note: '드릴 2개 + 전체 동작 1개씩 번갈아' },
      advanced: { reps: 16, distance: 25, restCs: 15 * SECONDS, paceOffsetCs: 0, effort: 'technique', note: '스컬링 포함, 드릴 1 + 전체 1' },
      elite: { reps: 16, distance: 25, restCs: 15 * SECONDS, paceOffsetCs: 0, effort: 'technique', note: '약점 한 가지만 골라 집중' },
    },
  },
  {
    kind: 'pool',
    id: 'kick',
    name: '킥 세트',
    category: 'technique',
    purpose: '벽 이후 구간과 후반 속도 유지를 담당하는 하체를 만든다.',
    principle:
      '25m 단수로에서는 매 벽마다 킥으로만 나아가는 구간이 생긴다. 상체가 지친 후반에 속도를 지탱하는 것도 하체다.',
    cautions: [
      '킥판에 상체를 얹고 허리를 젖히면 허리에 부담이 간다. 판을 짧게 잡거나 없이 한다.',
      '평영 킥은 무릎에 부담이 크다. 무릎 통증이 있으면 다른 영법 킥으로 대체한다.',
    ],
    levels: {
      beginner: { reps: 8, distance: 25, restCs: 25 * SECONDS, paceOffsetCs: 0, effort: 'easy' },
      intermediate: { reps: 12, distance: 25, restCs: 20 * SECONDS, paceOffsetCs: 0, effort: 'easy' },
      advanced: { reps: 16, distance: 25, restCs: 20 * SECONDS, paceOffsetCs: 0, effort: 'easy', note: '절반은 판 없이' },
      elite: { reps: 20, distance: 25, restCs: 15 * SECONDS, paceOffsetCs: 0, effort: 'easy', note: '판 없이, 4개마다 전력 1개' },
    },
  },
  {
    kind: 'pool',
    id: 'aerobic',
    name: '유산소 지속',
    category: 'aerobic',
    purpose: '고강도 세트를 감당할 바탕과 회복 속도를 만든다.',
    principle:
      '스프린터에게도 기초 지속력이 필요하다. 회복이 빠를수록 같은 시간에 더 많은 레이스 페이스 반복을 소화할 수 있다.',
    cautions: [
      '이 세트를 빠르게 가면 다음 고강도 세트를 망친다. 편하게 가는 것이 이 세트의 목적이다.',
    ],
    levels: {
      beginner: { reps: 4, distance: 100, restCs: 30 * SECONDS, paceOffsetCs: 0, effort: 'easy' },
      intermediate: { reps: 6, distance: 100, restCs: 25 * SECONDS, paceOffsetCs: 0, effort: 'easy' },
      advanced: { reps: 6, distance: 200, restCs: 30 * SECONDS, paceOffsetCs: 0, effort: 'easy' },
      elite: { reps: 8, distance: 200, restCs: 25 * SECONDS, paceOffsetCs: 0, effort: 'easy' },
    },
  },
  {
    kind: 'pool',
    id: 'recovery',
    name: '회복 스윔',
    category: 'aerobic',
    purpose: '고강도 세션 사이의 회복을 앞당긴다.',
    principle:
      '완전히 쉬는 것보다 가볍게 움직이는 편이 회복이 빠르다. 마스터즈는 회복 속도가 훈련량의 실질적 상한이다.',
    cautions: ['페이스를 재지 않는다. 시계를 보기 시작하면 회복 세션이 아니다.'],
    levels: {
      beginner: { reps: 6, distance: 50, restCs: 20 * SECONDS, paceOffsetCs: 0, effort: 'easy' },
      intermediate: { reps: 8, distance: 50, restCs: 20 * SECONDS, paceOffsetCs: 0, effort: 'easy' },
      advanced: { reps: 10, distance: 50, restCs: 15 * SECONDS, paceOffsetCs: 0, effort: 'easy' },
      elite: { reps: 12, distance: 50, restCs: 15 * SECONDS, paceOffsetCs: 0, effort: 'easy' },
    },
  },
  {
    kind: 'pool',
    id: 'time-trial',
    name: '테스트 세트',
    category: 'test',
    purpose: '목표까지 남은 격차를 측정한다.',
    principle:
      '훈련 세트의 성공률은 컨디션에 흔들린다. 목표 종목을 실제 조건으로 한 번 재야 진척이 확인된다. 구간 기록과 구간별 스트로크 수를 함께 재두면 진단의 재료가 된다.',
    cautions: [
      '4주에 한 번을 넘기지 않는다. 자주 재면 훈련 대신 측정을 하게 된다.',
      '전날 고강도 세트를 넣지 않는다. 컨디션이 다르면 비교할 수 없다.',
    ],
    levels: {
      beginner: { reps: 1, distance: 0, restCs: null, paceOffsetCs: 0, effort: 'max', note: '다이빙 스타트, 구간 기록 기록' },
      intermediate: { reps: 1, distance: 0, restCs: null, paceOffsetCs: 0, effort: 'max', note: '구간 기록 + 구간별 스트로크 수' },
      advanced: { reps: 1, distance: 0, restCs: null, paceOffsetCs: 0, effort: 'max', note: '구간 기록 + 스트로크 수 + 15m 통과' },
      elite: { reps: 2, distance: 0, restCs: null, paceOffsetCs: 0, effort: 'max', note: '충분한 회복 뒤 두 번, 좋은 쪽을 채택' },
    },
  },
]

// ---------------------------------------------------------------------------
// 육상
// ---------------------------------------------------------------------------

const DRYLAND_METHODS: TrainingMethod[] = [
  {
    kind: 'dryland',
    id: 'rotator-cuff',
    name: '회전근개 · 견갑 안정화',
    category: 'dryland',
    purpose: '수영 동호인이 훈련을 중단하는 가장 흔한 이유를 예방한다.',
    principle:
      '자유형과 접영은 어깨를 머리 위로 반복해서 넘긴다. 회전근개와 견갑 주위근이 그 궤도를 잡아주지 못하면 충돌이 생긴다. 밴드 외회전과 견갑 후인으로 궤도를 지탱하는 쪽을 먼저 만든다.',
    cautions: [
      '통증이 있는 상태에서 강화하면 악화된다. 통증은 훈련 대상이 아니라 진료 대상이다.',
      '무게보다 자세다. 어깨가 으쓱 올라가면 목표 근육이 빠지고 승모근이 대신 일한다.',
    ],
    levels: {
      beginner: { sets: 2, reps: '12~15회', note: '밴드 외회전 · 견갑 후인 · Y 레이즈' },
      intermediate: { sets: 3, reps: '12~15회', note: '위 3종 + T 레이즈' },
      advanced: { sets: 3, reps: '15회', note: 'Y-T-W 전체 + 밴드 저항 증가' },
      elite: { sets: 4, reps: '15회', note: 'Y-T-W + 한팔 플랭크 리치' },
    },
  },
  {
    kind: 'dryland',
    id: 'core-antirotation',
    name: '코어 안티로테이션',
    category: 'dryland',
    purpose: '스트로크마다 몸통이 흔들려 새는 힘을 줄인다.',
    principle:
      '팔이 물을 누르면 몸통은 반대로 비틀린다. 그 비틀림을 버티지 못하면 추진력이 회전으로 흩어진다. 그래서 몸통을 돌리는 운동보다 돌아가지 않게 버티는 운동이 수영에 직접 붙는다.',
    cautions: [
      '허리가 바닥에서 뜨면 코어가 아니라 허리로 버티는 것이다. 뜨는 순간 세트를 끝낸다.',
      '숨을 참지 않는다. 버티는 동안 호흡이 이어져야 한다.',
    ],
    levels: {
      beginner: { sets: 2, reps: '30초', note: '데드버그 · 플랭크' },
      intermediate: { sets: 3, reps: '30초', note: '데드버그 · 플랭크 · 사이드 플랭크' },
      advanced: { sets: 3, reps: '45초', note: '위 3종 + 팔로프 프레스' },
      elite: { sets: 4, reps: '45초', note: '팔로프 프레스 · 한팔 파머스 홀드 포함' },
    },
  },
  {
    kind: 'dryland',
    id: 'lower-power',
    name: '하체 파워',
    category: 'dryland',
    purpose: '스타트와 턴에서 벽을 미는 힘을 키운다.',
    principle:
      '하체 파워가 기록으로 바로 환산되는 구간은 벽뿐이다. 25m 단수로 100m 는 스타트 1회와 턴 3회, 즉 벽을 네 번 미는 종목이라 이득이 네 번 붙는다.',
    cautions: [
      '점프 동작은 무릎·발목에 부담이 크다. 40대 이후에는 체중 스쿼트로 자세를 먼저 잡고 넘어간다.',
      '수영 훈련 직전에는 하지 않는다. 다리가 지친 상태로는 킥과 턴이 무너진다.',
    ],
    levels: {
      beginner: { sets: 2, reps: '10회', note: '체중 스쿼트 · 힙 브리지' },
      intermediate: { sets: 3, reps: '8회', note: '스쿼트 · 런지 · 카프 레이즈' },
      advanced: { sets: 3, reps: '5회', note: '박스 점프 · 스쿼트 점프' },
      elite: { sets: 4, reps: '5회', note: '박스 점프 · 브로드 점프 · 한다리 홉' },
    },
  },
  {
    kind: 'dryland',
    id: 'mobility',
    name: '흉추 · 어깨 가동성',
    category: 'dryland',
    purpose: '스트로크 궤도가 가동범위 부족으로 어긋나는 것을 막는다.',
    principle:
      '어깨를 머리 위로 넘기는 각도는 흉추가 펴지는 만큼 나온다. 책상 앞에 앉아 지내는 성인은 여기가 굳어 있어, 부족한 각도를 어깨 관절이 무리해서 대신 만든다.',
    cautions: [
      '반동을 주지 않는다. 통증이 아니라 당김이 느껴지는 범위에서 멈춘다.',
      '훈련 전에는 움직이면서, 훈련 후에는 정지 상태로 늘린다.',
    ],
    levels: {
      beginner: { sets: 1, reps: '8~10회', note: '훈련 전 · 흉추 회전 · 어깨 원 돌리기' },
      intermediate: { sets: 2, reps: '8~10회', note: '훈련 전 · 흉추 회전 · 밴드 숄더 패스' },
      advanced: { sets: 2, reps: '10회', note: '훈련 전후 · 폼롤러 흉추 신전 추가' },
      elite: { sets: 2, reps: '10회', note: '훈련 전후 · 약한 방향을 골라 비대칭 교정' },
    },
  },
]

export const METHODS: readonly TrainingMethod[] = [...POOL_METHODS, ...DRYLAND_METHODS]

export function methodById(id: string): TrainingMethod | undefined {
  return METHODS.find((method) => method.id === id)
}

/** 수영장 방법의 등급별 파라미터. 육상 방법이거나 해당 등급에 처방하지 않으면 null. */
export function poolSpec(id: string, level: Level): PoolSpec | null {
  const method = methodById(id)
  return method?.kind === 'pool' ? method.levels[level] : null
}

/** 육상 방법의 등급별 파라미터. */
export function drylandSpec(id: string, level: Level): DrylandSpec | null {
  const method = methodById(id)
  return method?.kind === 'dryland' ? method.levels[level] : null
}

export const CATEGORY_LABEL: Record<MethodCategory, string> = {
  racePace: '레이스 페이스',
  speed: '최대 속도 · 파워',
  wall: '벽 구간 (스타트 · 턴 · 잠영)',
  technique: '기술',
  aerobic: '지속력 · 회복',
  test: '측정',
  dryland: '육상',
}

/**
 * 세트 한 줄을 사람이 읽는 지시문으로 바꾼다.
 *
 * `pace25Cs` 는 목표기록에서 나온 25m 목표 페이스이고, `targetDistance` 는
 * 사용자의 목표 종목 거리다(`distance: 0` 인 세트가 이 값을 쓴다).
 */
export function describePoolSet(spec: PoolSpec, pace25Cs: number, targetDistance: number): string {
  const distance = spec.distance === 0 ? targetDistance : spec.distance
  const lengths = distance / 25
  const repTargetCs = (pace25Cs + spec.paceOffsetCs) * lengths

  const head = `${spec.reps} × ${distance}m`

  if (spec.effort) {
    const label = { max: '전력', easy: '편하게', technique: '기술 위주' }[spec.effort]
    // 노력도 세트에는 목표 시간이 없으므로 인터벌을 계산할 수 없다. 휴식만 그대로 보여준다.
    const rest = spec.restCs === null ? '' : ` · 휴식 ${spec.restCs / SECONDS}초`
    return `${head} ${label}${rest}`
  }

  const target = `@ ${formatTime(repTargetCs)}`
  if (spec.restCs === null) return `${head} ${target}`

  return `${head} ${target} · 인터벌 ${formatTime(repTargetCs + spec.restCs)}`
}

/** 육상 세트 지시문. */
export function describeDrylandSet(spec: DrylandSpec): string {
  return `${spec.sets}세트 × ${spec.reps}`
}
