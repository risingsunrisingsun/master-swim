/**
 * 수영 용어집과 퀴즈.
 *
 * 마스터즈 회원이 코치의 말과 대회 안내문을 알아듣는 데 필요한 것만 담는다.
 * 사전이 아니라 **현장 통역기**다 — 정의보다 "언제 이 말을 듣게 되는가"를 적는다.
 *
 * 퀴즈는 이 목록에서 만들어진다. 용어를 추가하면 퀴즈도 자동으로 늘어난다.
 * 문제와 보기를 만드는 함수는 난수를 인자로 받는다 — 그래야 테스트할 수 있다.
 */

export type TermCategory = 'technique' | 'wall' | 'training' | 'meet' | 'gear'

export const CATEGORY_LABEL: Record<TermCategory, string> = {
  technique: '스트로크',
  wall: '벽 — 스타트와 턴',
  training: '훈련',
  meet: '대회',
  gear: '장비와 매너',
}

export interface Term {
  readonly id: string
  readonly term: string
  /** 영어 표기. 코치가 영어로 부르는 경우가 많아 함께 둔다. */
  readonly english?: string
  readonly category: TermCategory
  /** 한 줄 정의. 퀴즈 문제로 그대로 쓰인다. */
  readonly short: string
  /** 언제 이 말을 듣게 되는지, 왜 중요한지. */
  readonly detail?: string
}

export const TERMS: readonly Term[] = [
  // --- 스트로크 -----------------------------------------------------------
  {
    id: 'catch',
    term: '캐치',
    english: 'catch',
    category: 'technique',
    short: '손이 물에 들어간 뒤 물을 붙잡아 미는 힘으로 바꾸는 첫 구간.',
    detail: '여기서 미끄러지면 그 뒤 아무리 세게 당겨도 소용이 없다. "물을 잡아라"는 이 구간을 말한다.',
  },
  {
    id: 'high-elbow',
    term: '하이엘보',
    english: 'high elbow catch / EVF',
    category: 'technique',
    short: '캐치에서 팔꿈치를 손보다 높게 유지해 아래팔 전체로 물을 미는 자세.',
    detail: '팔꿈치가 먼저 떨어지면 손만으로 물을 밀게 되어 면적이 줄어든다. 동호인 자유형에서 가장 흔한 손실 지점이다.',
  },
  {
    id: 'dps',
    term: 'DPS',
    english: 'distance per stroke',
    category: 'technique',
    short: '스트로크 한 번에 나아가는 거리.',
    detail: '스트로크 수를 세면 알 수 있다. 25m 를 몇 번에 가느냐가 그것이다.',
  },
  {
    id: 'sr',
    term: 'SR',
    english: 'stroke rate',
    category: 'technique',
    short: '분당 스트로크 횟수. 팔을 얼마나 빨리 돌리는가.',
    detail: '속도 = DPS × SR 이다. 한쪽만 올리면 다른 쪽이 떨어져 제자리인 경우가 많다.',
  },
  {
    id: 'sculling',
    term: '스컬링',
    english: 'sculling',
    category: 'technique',
    short: '손바닥 각도를 바꿔가며 8자로 저어 물의 저항을 느끼는 훈련.',
    detail: '앞으로 가려고 하는 동작이 아니라 물을 감각하는 동작이다. 캐치가 미끄러지는 사람에게 먼저 처방한다.',
  },
  {
    id: 'streamline',
    term: '스트림라인',
    english: 'streamline',
    category: 'technique',
    short: '두 팔을 머리 위로 겹쳐 귀 뒤에 붙이고 몸을 일자로 만든 자세.',
    detail: '스타트와 모든 턴 직후에 쓴다. 이 자세가 무너지면 벽에서 얻은 속도가 그 자리에서 사라진다.',
  },
  {
    id: 'rolling',
    term: '롤링',
    english: 'body roll',
    category: 'technique',
    short: '자유형·배영에서 몸통을 좌우로 굴리는 움직임.',
    detail: '어깨만 돌리는 게 아니라 골반까지 함께 돈다. 롤링이 없으면 어깨만으로 당기게 되어 부상이 온다.',
  },
  {
    id: 'catch-up',
    term: '캐치업',
    english: 'catch-up drill',
    category: 'technique',
    short: '한 팔이 앞에서 기다렸다가 다른 팔이 도착하면 출발하는 드릴.',
    detail: '스트로크를 느리게 쪼개 각 구간을 확인하는 용도다. 레이스 자세는 아니다.',
  },

  // --- 벽 -----------------------------------------------------------------
  {
    id: 'flip-turn',
    term: '플립턴 (퀵턴)',
    english: 'flip turn / tumble turn',
    category: 'wall',
    short: '자유형·배영에서 벽 앞에서 앞구르기로 도는 턴.',
    detail: '손으로 벽을 짚지 않는다. 25m 단수로에서는 턴 횟수가 많아 여기서 벌어지는 차이가 크다.',
  },
  {
    id: 'open-turn',
    term: '오픈턴 (터치턴)',
    english: 'open turn',
    category: 'wall',
    short: '평영·접영에서 두 손으로 동시에 벽을 짚고 도는 턴.',
    detail: '평영과 접영은 규칙상 **양손 동시 터치**가 필수다. 한 손이 먼저 닿으면 실격이다.',
  },
  {
    id: 'pushoff',
    term: '푸시오프',
    english: 'push-off',
    category: 'wall',
    short: '벽을 발로 밀어 나가는 동작.',
    detail: '이 앱의 훈련 목표 페이스는 푸시오프 출발 기준이다 — 대회 첫 구간의 다이빙보다 느리기 때문에 그만큼 보정한다.',
  },
  {
    id: 'underwater',
    term: '언더워터 (돌핀킥)',
    english: 'underwater dolphin kick',
    category: 'wall',
    short: '스타트·턴 직후 물속에서 돌고래킥으로 나아가는 구간.',
    detail: '물 위를 젓는 것보다 저항이 적어 잘하는 사람에게는 가장 빠른 구간이다.',
  },
  {
    id: 'fifteen-metre',
    term: '15m 룰',
    english: '15-metre rule',
    category: 'wall',
    short: '스타트·턴 후 늦어도 15m 지점에서는 머리가 물 밖으로 나와야 한다는 규정.',
    detail: '평영을 제외한 세 영법에 적용된다. 바닥이나 레인 로프에 표시가 있다.',
  },

  // --- 훈련 ---------------------------------------------------------------
  {
    id: 'interval',
    term: '인터벌',
    english: 'send-off / interval',
    category: 'training',
    short: '한 반복을 출발해서 다음 반복을 출발할 때까지의 정해진 시간.',
    detail: '"50m × 8, 1분 출발"이면 1분마다 출발한다. 빨리 돌수록 쉬는 시간이 길어진다 — 휴식이 아니라 출발 간격이다.',
  },
  {
    id: 'race-pace',
    term: '레이스 페이스',
    english: 'race pace',
    category: 'training',
    short: '목표기록으로 완주할 때 유지해야 하는 구간 속도.',
    detail: '이 앱의 모든 세트가 이 한 숫자에 매달려 있다. 목표기록을 정하면 25m 당 몇 초로 돌아야 하는지가 나온다.',
  },
  {
    id: 'usrpt',
    term: 'USRPT',
    english: 'ultra-short race-pace training',
    category: 'training',
    short: '목표 레이스 페이스를 짧은 반복으로 여러 번 지키는 훈련 방식.',
    detail: '페이스를 못 지키면 그 지점에서 세트를 끝낸다. 실패 지점이 곧 측정값이다.',
  },
  {
    id: 'negative-split',
    term: '네거티브 스플릿',
    english: 'negative split',
    category: 'training',
    short: '후반을 전반보다 빠르게 가는 배분.',
    detail: '전반에 오버페이스하면 후반이 무너진다. 마스터즈 100m 에서 특히 자주 나오는 실패다.',
  },
  {
    id: 'descending',
    term: '디센딩',
    english: 'descending',
    category: 'training',
    short: '반복을 거듭할수록 기록을 점점 빠르게 만드는 세트.',
    detail: '"4개 디센딩"이면 1번보다 2번, 2번보다 3번이 빨라야 한다. 마지막 하나가 목표 페이스다.',
  },
  {
    id: 'build',
    term: '빌드',
    english: 'build',
    category: 'training',
    short: '한 반복 **안에서** 점점 속도를 올리는 것.',
    detail: '디센딩은 반복 사이, 빌드는 반복 안이다. 헷갈리기 쉬운 한 쌍이다.',
  },
  {
    id: 'taper',
    term: '테이퍼',
    english: 'taper',
    category: 'training',
    short: '대회 전 훈련량을 줄여 피로를 빼고 몸을 올리는 기간.',
    detail: '강도는 유지하고 분량만 줄이는 것이 핵심이다. 이 앱은 테이퍼를 처방하지 않는다.',
  },
  {
    id: 'pace-clock',
    term: '페이스 클럭',
    english: 'pace clock',
    category: 'training',
    short: '수영장 벽에 걸린 큰 초시계. 인터벌 출발 시각을 여기에 맞춘다.',
    detail: '보통 빨간 바늘이 60초를 한 바퀴 돈다. "탑(top)"은 0초, "바텀(bottom)"은 30초를 뜻한다.',
  },
  {
    id: 'set',
    term: '세트 / 리핏',
    english: 'set / repeat',
    category: 'training',
    short: '세트는 묶음, 리핏은 그 안의 한 번.',
    detail: '"50m × 8" 이 한 세트이고, 그 안의 50m 하나하나가 리핏이다.',
  },

  // --- 대회 ---------------------------------------------------------------
  {
    id: 'course',
    term: '숏코스 / 롱코스',
    english: 'short course / long course',
    category: 'meet',
    short: '25m 수영장이 숏코스, 50m 수영장이 롱코스.',
    detail: '같은 종목이라도 숏코스가 빠르다 — 턴이 많아 벽에서 얻는 이득이 많기 때문이다. 기록을 비교할 때 반드시 확인해야 한다.',
  },
  {
    id: 'split',
    term: '스플릿',
    english: 'split',
    category: 'meet',
    short: '구간별 기록. 100m 라면 25m·50m·75m 지점의 누적 시간.',
    detail: '최종 기록만으로는 어디서 무너졌는지 알 수 없다. 병목을 찾으려면 스플릿이 필요하다.',
  },
  {
    id: 'im-order',
    term: '개인혼영 순서',
    english: 'individual medley (IM)',
    category: 'meet',
    short: '접영 → 배영 → 평영 → 자유형 순서.',
    detail: '혼계영(릴레이)은 순서가 다르다 — 배영 → 평영 → 접영 → 자유형이다.',
  },
  {
    id: 'dq',
    term: 'DQ (실격)',
    english: 'disqualification',
    category: 'meet',
    short: '규정 위반으로 기록이 인정되지 않는 것.',
    detail: '마스터즈에서 흔한 원인은 평영·접영의 한 손 터치, 부정 출발, 배영 턴 규정 위반이다.',
  },
  {
    id: 'age-group',
    term: '연령부',
    english: 'age group',
    category: 'meet',
    short: '마스터즈 대회에서 나이로 나눈 출전 구분. 보통 5세 단위.',
    detail: '이 앱도 같은 단위로 등급과 백분위를 계산한다.',
  },
  {
    id: 'seed-time',
    term: '엔트리 기록',
    english: 'seed time',
    category: 'meet',
    short: '대회 신청할 때 적어 내는 예상 기록. 레인 배정의 기준이 된다.',
    detail: '너무 빠르게 적으면 빠른 조에서 혼자 뒤처지고, 너무 느리게 적으면 앞사람에게 막힌다.',
  },

  // --- 장비와 매너 --------------------------------------------------------
  {
    id: 'circle-swimming',
    term: '써클 스위밍',
    english: 'circle swimming',
    category: 'gear',
    short: '한 레인을 여럿이 쓸 때 오른쪽으로 돌며 도는 방식.',
    detail: '앞사람을 추월할 때는 벽에서 한다. 레인 한가운데서 추월하면 마주 오는 사람과 부딪힌다.',
  },
  {
    id: 'pull-buoy',
    term: '풀부이',
    english: 'pull buoy',
    category: 'gear',
    short: '허벅지 사이에 끼워 다리를 띄우는 부력 도구.',
    detail: '킥을 멈추고 상체만으로 도는 훈련에 쓴다. 다리가 가라앉는 사람에게는 물 위치를 잠시 느끼게 해주는 용도이기도 하다.',
  },
  {
    id: 'paddle',
    term: '패들',
    english: 'hand paddle',
    category: 'gear',
    short: '손에 끼워 물 잡는 면적을 늘리는 판.',
    detail: '어깨 부담이 크게 늘어난다. 자세가 잡히기 전에 쓰면 부상으로 간다 — 마스터즈에서 특히 조심할 도구다.',
  },
  {
    id: 'kickboard',
    term: '킥판',
    english: 'kickboard',
    category: 'gear',
    short: '손으로 잡고 킥만 하는 판.',
    detail: '목과 허리를 젖히고 오래 하면 부담이 된다. 얼굴을 물에 넣었다 드는 방식이 낫다.',
  },
  {
    id: 'snorkel',
    term: '센터 스노클',
    english: 'center snorkel',
    category: 'gear',
    short: '이마 가운데에 다는 호흡관. 고개를 돌리지 않고 숨을 쉰다.',
    detail: '호흡 때문에 무너지는 자세를 분리해서 볼 수 있어, 자세 교정 드릴에 자주 쓴다.',
  },
]

export function termById(id: string): Term | undefined {
  return TERMS.find((term) => term.id === id)
}

export function termsByCategory(category: TermCategory): readonly Term[] {
  return TERMS.filter((term) => term.category === category)
}

/**
 * 용어를 찾는다.
 *
 * 표제어·영어 표기·한 줄 정의를 모두 훑는다. **영어를 훑는 이유는 코치가 영어로
 * 부르는 경우가 많기 때문이다** — "EVF" 를 듣고 온 회원이 '하이엘보'를 찾을 수 있어야 한다.
 *
 * 표제어에 맞은 것이 정의에 맞은 것보다 앞에 온다. '스트로크'로 찾으면 표제어가
 * `세트 / 리핏` 인 것보다 스트로크 자체를 다루는 용어가 먼저 나와야 한다.
 *
 * **초성 검색은 하지 않는다.** 용어가 32개뿐이라 얻는 것보다 드는 비용이 크다.
 *
 * 빈 문자열이면 빈 배열이다 — 화면은 그때 분류별 전체 목록으로 돌아간다.
 * '전부 맞았다'와 '아직 안 찾았다'는 다른 상태이므로 여기서 섞지 않는다.
 */
export function searchTerms(query: string): readonly Term[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []

  const inHead = (term: Term): boolean =>
    term.term.toLowerCase().includes(needle) || (term.english?.toLowerCase().includes(needle) ?? false)

  const inBody = (term: Term): boolean =>
    term.short.toLowerCase().includes(needle) || (term.detail?.toLowerCase().includes(needle) ?? false)

  return [...TERMS.filter(inHead), ...TERMS.filter((term) => !inHead(term) && inBody(term))]
}

// ---------------------------------------------------------------------------
// 퀴즈
// ---------------------------------------------------------------------------

export const OPTION_COUNT = 4

export interface QuizQuestion {
  readonly termId: string
  /** 설명을 주고 용어를 맞힌다. 반대로 하면 보기가 너무 길어져 폰에서 읽기 어렵다. */
  readonly prompt: string
  readonly options: readonly string[]
  /** `options` 안에서 정답의 위치 */
  readonly answer: number
  /** 오답일 때 보여줄 한 줄. 틀린 채로 넘어가면 퀴즈가 아니라 그냥 찍기다. */
  readonly explain: string
}

/**
 * 배열을 섞는다. Fisher-Yates.
 *
 * `rng` 를 밖에서 받는 이유는 테스트 때문이다 — 섞는 규칙을 검사하려면
 * 난수가 인자여야 한다.
 */
function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

/**
 * 오답 보기를 고른다.
 *
 * **같은 분류에서 먼저 채운다.** 스트로크 용어 문제에 장비 이름이 섞이면 몰라도
 * 소거법으로 맞힐 수 있어 퀴즈가 헐거워진다. 같은 분류가 모자라면 전체에서 채운다.
 */
function distractorsFor(answer: Term, rng: () => number): Term[] {
  const need = OPTION_COUNT - 1
  const sameCategory = TERMS.filter(
    (term) => term.id !== answer.id && term.category === answer.category,
  )
  const rest = TERMS.filter((term) => term.id !== answer.id && term.category !== answer.category)
  return [...shuffled(sameCategory, rng), ...shuffled(rest, rng)].slice(0, need)
}

/** 용어집에서 문제를 만든다. `count` 가 용어 수보다 많으면 용어 수만큼만 낸다. */
export function buildQuiz(count: number, rng: () => number = Math.random): QuizQuestion[] {
  return shuffled(TERMS, rng)
    .slice(0, Math.max(0, Math.min(count, TERMS.length)))
    .map((term) => {
      const options = shuffled([term, ...distractorsFor(term, rng)], rng)
      return {
        termId: term.id,
        prompt: term.short,
        options: options.map((option) => option.term),
        answer: options.findIndex((option) => option.id === term.id),
        explain: term.detail ?? term.short,
      }
    })
}

/** 맞힌 개수로 한 줄 총평. 점수만 던지면 다시 풀 이유가 없다. */
export function quizVerdict(correct: number, total: number): string {
  if (total === 0) return ''
  const ratio = correct / total
  if (ratio === 1) return '전부 맞혔습니다. 코치 말을 놓칠 일은 없겠습니다.'
  if (ratio >= 0.8) return '잘 아시네요. 틀린 것만 다시 보면 됩니다.'
  if (ratio >= 0.5) return '절반은 넘겼습니다. 용어집을 한 번 훑고 다시 풀어보세요.'
  return '용어집을 먼저 읽고 오시면 훨씬 쉽습니다.'
}
