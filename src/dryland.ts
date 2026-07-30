/**
 * 영법별 지상훈련 세트.
 *
 * `methods.ts` 의 육상 방법 넷과 역할이 다르다. 그쪽은 **주간 플랜에 끼워 넣는
 * 등급별 처방**이고, 여기는 **내 종목에 뭐가 필요한지 찾아보는 참고 자료**다.
 * 겹치는 세트는 `method` 로 그쪽을 가리킨다 — 세트 수·반복 수의 원본은 언제나
 * `methods.ts` 다. 두 곳에 같은 숫자를 적어두면 한쪽만 고쳐지는 날이 온다.
 *
 * **영상은 실존을 확인했지만 내용을 보증하지 않는다.** 모든 링크를 YouTube oEmbed 로
 * 조회해 제목과 채널을 그대로 받아 적었다(살아 있는 영상만 들어 있다). 하지만 영상을
 * 재생해 본 것은 아니므로, 화면이 채널명을 함께 띄워 회원이 직접 판단하게 한다.
 * 링크가 죽으면 `videos` 에서 빼면 된다 — 다른 코드는 이 파일만 본다.
 */
import type { Stroke } from './types'

/** YouTube 영상 하나. `id` 는 watch?v= 뒤에 오는 값이다. */
export interface VideoLink {
  readonly id: string
  /** oEmbed 가 돌려준 제목 그대로 */
  readonly title: string
  /** 채널명. 회원이 출처를 보고 판단할 수 있게 화면에 함께 뜬다. */
  readonly channel: string
}

export interface DrylandExercise {
  readonly name: string
  /** 세트 × 반복. 등급을 나누지 않는다 — 등급별 처방은 주간 플랜이 한다. */
  readonly prescription: string
  /** 한 줄 요령. 이게 없으면 동작 이름만 남아 아무 도움이 안 된다. */
  readonly cue: string
}

export interface DrylandSet {
  readonly id: string
  /** `common` 은 영법을 가리지 않는다. */
  readonly scope: Exclude<Stroke, 'im'> | 'common'
  readonly title: string
  /** 왜 이걸 하는가. 수영의 어느 구간에 붙는지로 적는다. */
  readonly why: string
  readonly exercises: readonly DrylandExercise[]
  readonly videos: readonly VideoLink[]
  /** 주간 플랜에 이미 들어 있는 방법이면 그 id (`methods.ts`). */
  readonly method?: string
}

const COMMON_SETS: readonly DrylandSet[] = [
  {
    id: 'shoulder',
    scope: 'common',
    method: 'rotator-cuff',
    title: '어깨를 지킨다',
    why: '동호인이 훈련을 중단하는 가장 흔한 이유가 어깨다. 자유형과 접영은 팔을 머리 위로 수천 번 넘기는데, 그 궤도를 잡아주는 근육이 약하면 관절이 부딪힌다. 기록을 올리는 훈련이 아니라 **훈련을 계속하기 위한 훈련**이다.',
    exercises: [
      {
        name: '밴드 외회전',
        prescription: '3세트 × 12~15회 (양쪽)',
        cue: '팔꿈치를 옆구리에 붙이고 90도로 고정한 채 아래팔만 바깥으로. 어깨가 으쓱 올라가면 승모근이 대신 일하고 있는 겁니다.',
      },
      {
        name: 'Y-T-W 레이즈',
        prescription: '각 2~3세트 × 12회',
        cue: '엎드리거나 상체를 숙이고 팔로 Y·T·W 를 만듭니다. 무게보다 견갑을 먼저 모으는 순서가 중요합니다.',
      },
      {
        name: '견갑 후인 (밴드 로우)',
        prescription: '3세트 × 15회',
        cue: '당길 때 날개뼈를 뒤 아래로. 팔로 당기지 말고 등으로 당기세요.',
      },
    ],
    videos: [
      { id: '7cGY6EHcNt4', title: 'SHOULDER REHAB | Swimming Injury Prevention Exercises', channel: 'Propulsion Swimming' },
      { id: '0cYC3J6Mh_k', title: 'Shoulder Exercises To Improve Function of the Rotator Cuff & Scapular Stabilizers for Swimming', channel: 'Christopher Johnson' },
      { id: '3Meavq45J7Q', title: 'Shoulder Exercises for Swimmers', channel: 'Airrosti Rehab Centers' },
    ],
  },
  {
    id: 'core',
    scope: 'common',
    method: 'core-antirotation',
    title: '코어 — 돌아가지 않게 버틴다',
    why: '팔이 물을 누르면 몸통은 반대로 비틀린다. 그 비틀림을 버티지 못하면 추진력이 회전으로 새어 나간다. 그래서 **몸통을 돌리는 운동보다 돌아가지 않게 버티는 운동**이 수영에 직접 붙는다.',
    exercises: [
      {
        name: '데드버그',
        prescription: '3세트 × 30초',
        cue: '허리가 바닥에서 뜨는 순간 세트를 끝내세요. 뜨면 코어가 아니라 허리로 버티는 겁니다.',
      },
      {
        name: '플랭크 · 사이드 플랭크',
        prescription: '각 3세트 × 30~45초',
        cue: '엉덩이를 들지도 떨어뜨리지도 마세요. 숨을 참으면 안 됩니다.',
      },
      {
        name: '팔로프 프레스',
        prescription: '3세트 × 10회 (양쪽)',
        cue: '밴드를 옆에서 당기고 몸이 끌려가지 않게 버티며 앞으로 밉니다. 스트로크의 비틀림과 가장 닮은 동작입니다.',
      },
    ],
    videos: [
      { id: '0PtvIt47W4g', title: '6 Beginner Core Dryland Exercise for #Swimmers!', channel: 'U.S. Masters Swimming' },
      { id: 'x4uVcmXDSQg', title: '6 Advanced Core Exercises for #Swimmers 🏊🏼‍♀️', channel: 'U.S. Masters Swimming' },
      { id: 'fktpXKJ_2_c', title: '10 Best Core Dryland Exercises For Swimmers', channel: 'Fares Ksebati' },
    ],
  },
  {
    id: 'mobility',
    scope: 'common',
    method: 'mobility',
    title: '가동성 — 각도가 나와야 궤도가 산다',
    why: '팔을 머리 위로 넘기는 각도는 흉추가 펴지는 만큼 나온다. 책상 앞에 앉아 지내는 성인은 여기가 굳어 있어서, 모자란 각도를 어깨 관절이 무리해서 대신 만든다. 기술 문제로 보이는 것이 사실 가동범위 문제인 경우가 많다.',
    exercises: [
      {
        name: '흉추 회전 (오픈 북)',
        prescription: '2세트 × 8~10회 (양쪽)',
        cue: '옆으로 누워 무릎을 고정하고 위쪽 팔만 넘깁니다. 골반이 따라 돌면 흉추가 아니라 허리가 도는 겁니다.',
      },
      {
        name: '밴드 숄더 패스',
        prescription: '2세트 × 10회',
        cue: '밴드를 넓게 잡고 앞에서 뒤로 넘깁니다. 좁게 잡을수록 어렵습니다 — 반동 없이 되는 폭에서 시작하세요.',
      },
      {
        name: '폼롤러 흉추 신전',
        prescription: '2세트 × 10회',
        cue: '롤러를 등 위쪽에 대고 폅니다. 허리에서 꺾지 마세요.',
      },
    ],
    videos: [
      { id: 'By1QlO0Kyp8', title: '15 Min. Mobility & Flexibility for Swimmers | Shoulders, Spine & Hips', channel: 'mobility by julia reppel' },
    ],
  },
  {
    id: 'wall-power',
    scope: 'common',
    method: 'lower-power',
    title: '벽을 미는 힘',
    why: '하체 힘이 기록으로 바로 환산되는 구간은 벽뿐이다. **25m 단수로에서 100m 는 스타트 1회 + 턴 3회**, 즉 벽을 네 번 민다. 여기서 0.1초씩만 벌어도 0.4초다.',
    exercises: [
      {
        name: '스쿼트',
        prescription: '3세트 × 8~10회',
        cue: '무릎이 안으로 모이지 않게. 40대 이후라면 체중으로 자세를 먼저 잡고 무게를 얹으세요.',
      },
      {
        name: '힙 브리지 · 한다리 브리지',
        prescription: '3세트 × 12회',
        cue: '엉덩이로 밀어 올립니다. 허벅지 뒤가 먼저 타면 엉덩이가 일을 안 하는 겁니다.',
      },
      {
        name: '박스 점프 (선택)',
        prescription: '3세트 × 5회',
        cue: '뛰어오르되 **내려올 때는 걸어서** 내려옵니다. 착지 충격이 관절 부담의 대부분입니다.',
      },
    ],
    videos: [
      { id: 'JXBIZW-HeK8', title: "Dry-land Swimming Workout :: Core strength and shoulder stability", channel: "Skills N' Talents (swimming)" },
    ],
  },
]

const STROKE_SETS: readonly DrylandSet[] = [
  {
    id: 'free',
    scope: 'free',
    title: '자유형',
    why: '자유형은 광배근으로 물을 당기고 몸통 롤링으로 그 힘을 잇는다. 발목이 뻣뻣하면 킥이 브레이크가 되므로 발목 가동성이 의외로 크게 붙는다.',
    exercises: [
      {
        name: '밴드 풀다운 (하이엘보)',
        prescription: '3세트 × 12회 (양쪽)',
        cue: '팔꿈치를 높게 유지한 채 아래로 당깁니다. 팔꿈치가 먼저 떨어지면 물이 빠지는 그 자세입니다.',
      },
      {
        name: '발목 가동성 (무릎 꿇고 발등 누르기)',
        prescription: '2세트 × 30초',
        cue: '발등이 바닥에 붙는 범위까지. 통증이 아니라 당김에서 멈추세요.',
      },
      {
        name: '사이드 플랭크 로테이션',
        prescription: '3세트 × 10회 (양쪽)',
        cue: '롤링을 버티는 힘을 만듭니다. 어깨가 아니라 몸통으로 돕니다.',
      },
    ],
    videos: [
      { id: '0rSW4WpXi-w', title: 'Freestyle swimming at home exercises. Dryland. Episode 5. Strength, technique and mobility', channel: "Skills N' Talents (swimming)" },
      { id: 'y7t40xRus98', title: '3 Dryland Exercises to Improve Your Freestyle Swimming', channel: 'Swim Like A. Fish' },
      { id: 'ztmWxvDcDM0', title: 'Dryland Exercises For Swimmers: Arrow freestyle swimming technique', channel: "Skills N' Talents (swimming)" },
      { id: 'bGEFl4yLHPc', title: 'Dryland training for swimmers - Ankle flexibility exercises swimming', channel: 'Tessa Rhodes' },
    ],
  },
  {
    id: 'back',
    scope: 'back',
    title: '배영',
    why: '배영은 누운 자세를 유지하는 힘과 어깨 뒤쪽 가동성이 전부다. 엉덩이가 가라앉으면 아무리 세게 당겨도 앞으로 안 간다.',
    exercises: [
      {
        name: '힙 브리지 홀드',
        prescription: '3세트 × 30초',
        cue: '누운 자세에서 엉덩이를 띄운 높이가 물에서의 몸 위치가 됩니다.',
      },
      {
        name: '밴드 스트레이트암 풀오버',
        prescription: '3세트 × 12회',
        cue: '팔을 편 채 머리 위에서 허벅지까지. 배영 풀의 궤도와 같습니다.',
      },
      {
        name: '어깨 신전 스트레칭',
        prescription: '2세트 × 30초',
        cue: '뒤로 손을 잡고 폅니다. 배영 입수 각도는 여기서 나옵니다.',
      },
    ],
    videos: [
      { id: 'UijYD0-DtG8', title: 'Maximize Your Backstroke Body Position // 10 Dryland Exercises', channel: 'U.S. Masters Swimming' },
      { id: '6lxkISmHMh0', title: 'Maximize Your Backstroke Pulling // 10 Dryland Exercises', channel: 'U.S. Masters Swimming' },
      { id: 'Q87tRlhCndk', title: 'Best dryland exercise for your backstroke pull', channel: 'Inside with Brett Hawke' },
      { id: 'JBtEgy7k-eA', title: 'Backstroke Workout For Swimmers | No Equipment Dryland', channel: 'The Apollo Athletic' },
    ],
  },
  {
    id: 'breast',
    scope: 'breast',
    title: '평영',
    why: '평영은 네 영법 중 유일하게 **킥이 추진의 절반 이상**이다. 고관절 안쪽·바깥쪽과 발목 회전 범위가 곧 킥의 크기이고, 여기가 막히면 상체를 아무리 만들어도 안 빨라진다.',
    exercises: [
      {
        name: '고관절 내전·외전 (밴드)',
        prescription: '3세트 × 15회 (양쪽)',
        cue: '평영 킥의 마지막 조이는 구간이 내전입니다. 여기를 놓치면 물이 새어 나갑니다.',
      },
      {
        name: '개구리 자세 (프로그 스트레치)',
        prescription: '2세트 × 30~45초',
        cue: '무릎을 벌리고 엎드려 골반을 낮춥니다. 평영 킥 시작 자세를 땅에서 만드는 겁니다.',
      },
      {
        name: '발목 외회전 스트레칭',
        prescription: '2세트 × 30초 (양쪽)',
        cue: '앉아서 발바닥을 바깥으로 돌립니다. 평영 킥은 발바닥으로 물을 잡는 동작입니다.',
      },
    ],
    videos: [
      { id: 'squfYvmyU5s', title: 'Dry-land Workout for Breaststroke Kick', channel: "FASTER Swimming by Skills N'T" },
      { id: 'e86KcUIQjLQ', title: 'Dryland Workout For Breaststroke Swimmers | No Equipment', channel: 'The Apollo Athletic' },
      { id: 'qRkQq4AQE70', title: 'Breaststroke Kick Strength Training and Technique, Dryland Resistance Band Exercises for Swimmers', channel: 'Elite Athlete Fitness Equipment' },
      { id: '6jX1PUY1M-8', title: 'Breaststroke simulation workout - Episode 2 - Dryland for swimmers', channel: "Skills N' Talents (swimming)" },
    ],
  },
  {
    id: 'fly',
    scope: 'fly',
    title: '접영',
    why: '접영은 흉추가 펴지는 만큼 물 위로 나온다. 가동범위가 모자라면 허리를 꺾어 대신 만들게 되고, 그게 동호인 접영에서 허리가 아픈 이유다. **광배근 파워보다 흉추 신전이 먼저**다.',
    exercises: [
      {
        name: '폼롤러 흉추 신전',
        prescription: '3세트 × 10회',
        cue: '롤러를 등 위쪽에 대고 폅니다. 허리에서 꺾이면 위치를 위로 옮기세요.',
      },
      {
        name: '슈퍼맨 홀드',
        prescription: '3세트 × 20초',
        cue: '엎드려 팔다리를 듭니다. 목은 젖히지 마세요 — 시선은 바닥.',
      },
      {
        name: '밴드 더블암 풀다운',
        prescription: '3세트 × 10회',
        cue: '양팔을 동시에 당깁니다. 접영은 좌우가 함께 일하므로 한팔 운동만으로는 만들어지지 않습니다.',
      },
    ],
    videos: [
      { id: '1gecW7zGkYY', title: 'Butterfly dryland swimming workout. Episode #8. Exercises for swimmers', channel: "Skills N' Talents (swimming)" },
      { id: 'h-OSzUd2NS4', title: 'Swimming backstroke simulation workout - Ep 3', channel: "Skills N' Talents (swimming)" },
    ],
  },
]

export const DRYLAND_SETS: readonly DrylandSet[] = [...COMMON_SETS, ...STROKE_SETS]

/** 공통 세트 + 고른 영법의 세트. 개인혼영은 네 영법 전부를 돌려준다. */
export function setsFor(stroke: Stroke): readonly DrylandSet[] {
  const common = DRYLAND_SETS.filter((set) => set.scope === 'common')
  const byStroke =
    stroke === 'im'
      ? DRYLAND_SETS.filter((set) => set.scope !== 'common')
      : DRYLAND_SETS.filter((set) => set.scope === stroke)
  return [...common, ...byStroke]
}

/**
 * 지상훈련 세트를 찾는다.
 *
 * 세트 제목·설명, 동작 이름·요령, 영상 제목·채널을 모두 훑는다. 회원이 실제로 치는 말
 * ("어깨" · "밴드" · "코어")이 이 필드들에 이미 들어 있다.
 *
 * **영법을 가리지 않는다.** '밴드'를 친 사람은 자기 영법 밖의 밴드 동작도 보고 싶어한다.
 * 영법으로 좁히는 것은 `setsFor` 의 일이다.
 *
 * 돌려주는 단위는 **세트 전체**다. 동작 하나만 떼어 보여주면 왜 그걸 하는지(`why`)가
 * 떨어져 나가 아무 도움이 안 된다.
 *
 * 빈 문자열이면 빈 배열 — `searchTerms` 와 같은 규칙이다.
 */
export function searchDryland(query: string): readonly DrylandSet[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []

  const hit = (text: string): boolean => text.toLowerCase().includes(needle)

  return DRYLAND_SETS.filter(
    (set) =>
      hit(set.title) ||
      hit(set.why) ||
      set.exercises.some((exercise) => hit(exercise.name) || hit(exercise.cue)) ||
      set.videos.some((video) => hit(video.title) || hit(video.channel)),
  )
}

export function videoUrl(video: VideoLink): string {
  return `https://www.youtube.com/watch?v=${video.id}`
}
