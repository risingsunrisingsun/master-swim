/**
 * 메뉴 화면 아래 빈자리에 접속할 때마다 하나씩 뜨는 카드.
 *
 * 두 종류가 섞여 있다. **선수의 말**(`kind: 'athlete'`)은 누가 했는지가 카드의
 * 절반이라 이름·출처·사진이 따라붙는다. **지은이 없는 문구**(`kind: 'saying'`)는
 * 귀속시킬 사람이 없으므로 그런 것이 아예 없다.
 *
 * 선수의 말에 대해 두 가지를 지킨다.
 *
 * **어록은 지어내지 않는다.** 실존 인물이 하지 않은 말을 그 사람 이름으로 띄우는 것은
 * 오귀속이다. `source` 가 있으면 그 주소에서 원문을 확인한 것이고, **없으면 확인하지
 * 못했다는 뜻이며 화면이 '출처 미확인'이라고 밝힌다.** BrainyQuote·Goodreads 같은
 * 인용구 모음 사이트는 출처로 쓰지 않는다 — 1차 출처가 없고 오귀속이 흔하다.
 *
 * **사진은 라이선스를 확인한 것만 쓴다.** 전부 위키미디어 공용에서 받았고 파일마다
 * 촬영자와 라이선스가 명시돼 있다. CC BY 계열은 저작자 표시가 조건이므로
 * `photo.by`·`photo.license` 를 화면에 **반드시 함께 띄운다**(`view.ts`).
 * 구글 이미지 검색의 '사용 권한' 필터는 라이선스를 보증하지 않아 쓰지 않았다.
 *
 * 사진 파일은 `web/quotes/<id>.jpg` 다. 원본과 잘라내기 좌표는
 * `assets/quotes/` 와 `scripts/make-quote-photos.ps1` 에 있다.
 * `photo` 를 빼면 화면이 이름 첫 글자를 원 안에 넣는다 — 서머 매킨토시와 에릭
 * 무삼바니가 그렇다. 없는 사진을 아무거나 채워 넣는 것보다 비워 두는 편이 정직하다.
 *
 * 카드 전부를 한 화면에서 보려면 `bun scripts/preview-quotes.ts`.
 */

/** 자유 라이선스 사진이 있을 때만 붙는다. 세 값이 함께 가야 저작자 표시가 성립한다. */
export interface QuotePhoto {
  /** 저작자. CC BY 계열의 조건이므로 화면에 그대로 뜬다. */
  readonly by: string
  readonly license: string
  /** 위키미디어 공용 파일 페이지 — 라이선스 원문을 확인할 수 있는 곳 */
  readonly source: string
}

/**
 * 선수의 말.
 *
 * 누가 했는지가 카드의 절반이므로 이름·국적·출처가 함께 간다.
 */
export interface AthleteQuote {
  readonly kind: 'athlete'
  /** 사진 파일 이름과 같다. `web/quotes/<id>.jpg` */
  readonly id: string
  /** 화면에 뜨는 이름 */
  readonly name: string
  /** 국적 · 주 종목 */
  readonly note: string
  /** 한국어 문장. 원문이 한국어면 그대로다. */
  readonly text: string
  /** 한국어가 아닌 원문. 번역이 미덥지 않을 때 대조할 수 있게 함께 둔다. */
  readonly original?: string
  /** 어디서 한 말인지 */
  readonly said: string
  /**
   * 원문을 확인한 곳.
   *
   * **없으면 1차 출처를 확인하지 못했다는 뜻이고, 화면이 '출처 미확인'이라고 밝힌다.**
   * 회원이 알려준 문장 중 검색으로 원문이 나오지 않은 것들이 여기 해당한다.
   * 없는 출처를 그럴듯한 링크로 채우느니 비어 있다고 적는 편이 낫다.
   */
  readonly source?: string
  /** 없으면 화면이 이름 첫 글자를 원 안에 넣는다. */
  readonly photo?: QuotePhoto
}

/**
 * 수영장에서 도는 문구.
 *
 * 지은이가 없으므로 **출처도 사진도 이름도 없다** — 없는 것이 아니라 있을 자리가
 * 없는 것이다. 실존 인물에게 귀속시키지 않으니 ADR-0009 의 검증 문제도 생기지 않는다.
 * 카드도 다르게 생겼다(`view.ts`).
 */
export interface Saying {
  readonly kind: 'saying'
  readonly id: string
  /** 영어 원문. 이쪽이 크게 뜬다 — 문구의 맛이 영어 어순에 있다. */
  readonly text: string
  /** 한국어 옮김. 영어 아래 작게 붙는다. */
  readonly korean: string
}

export type Quote = AthleteQuote | Saying

export const QUOTES: readonly Quote[] = [
  {
    // 회원이 고른 문장이다. 1차 출처를 찾지 못해 '출처 미확인'으로 나간다.
    //
    // 뜻이 거의 같으면서 확인된 문장이 하나 있다 — 베이징 2008 에서 통산 11번째 금메달
    // 뒤 NBC 에 한 말: "Eat, sleep and swim, that's all I can do."
    // (https://www.olympics.com/en/news/michael-phelps-10000-calories-diet-what-the-american-swimmer-ate-while-training-)
    // 바꾸고 싶어지면 그쪽으로 갈아끼우면 출처 링크까지 함께 붙는다.
    kind: 'athlete',
    id: 'phelps',
    name: '마이클 펠프스',
    note: '미국 · 접영/개인혼영',
    text: '오늘이 무슨 요일인지도 몰라요. 전 그냥 수영만 해요.',
    said: '회원 제공',
    photo: { by: 'Agência Brasil Fotografias', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Michael_Phelps_Rio_Olympics_2016.jpg' },
  },
  {
    kind: 'athlete',
    id: 'ledecky',
    name: '케이티 러데키',
    note: '미국 · 자유형 장거리',
    text: '자기 레이스에서 이기면 됩니다. 그리고 자기 레이스에서 이긴다는 건 시상대가 아니라 과정을 사랑하게 되는 것입니다.',
    original:
      'You just need to win your race. And winning your race means falling in love with the process, not the podium.',
    said: '스탠퍼드대 졸업식 연설',
    source:
      'https://www.olympics.com/en/news/katie-ledecky-gen-z-set-goals-but-you-dont-have-to-achieve-them',
    photo: { by: 'Mledecky', license: 'CC0', source: 'https://commons.wikimedia.org/wiki/File:Katie_Ledecky_at_the_2023_Golden_Goggle_Awards.jpg' },
  },
  {
    kind: 'athlete',
    id: 'dressel',
    name: '케일럽 드레슬',
    note: '미국 · 자유형/접영 단거리',
    text: '나는 매일 오늘 더 나아지러 왔다는 마음으로 훈련에 나갑니다.',
    original: "I come to practice every day with the mindset that I'm there to get better.",
    said: 'Olympics.com 단독 인터뷰',
    source:
      'https://www.olympics.com/en/news/caeleb-dressel-exclusive-critic-mentality-joy-chaos-parenthood-swimming-interview',
    photo: { by: 'JD Lasica', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Caeleb_Dressel_before_winning_100_fly_(42769914221)_(cropped).jpg' },
  },
  {
    kind: 'athlete',
    id: 'thorpe',
    name: '이언 소프',
    note: '호주 · 자유형',
    text: '경기에 들어갈 때마다 나는 내 안에서 가장 좋은 것을 꺼내려고 합니다.',
    original: 'Every time I go into a swimming race I try to get the best out of myself.',
    said: '2000년 시드니 올림픽 직후 인터뷰',
    source:
      'https://www.swimmingworldmagazine.com/news/olympic-quotes-from-australian-superstar-ian-thorpe/',
    photo: { by: 'Doha Stadium Plus Qatar', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Ian_Thorpe_2012.jpg' },
  },
  {
    kind: 'athlete',
    id: 'sjostrom',
    name: '사라 셰스트룀',
    note: '스웨덴 · 접영/자유형 단거리',
    text: '나는 나를 나하고만 비교합니다. 예전의 나보다 나아지고 싶을 뿐입니다.',
    original:
      'I just like to compare myself to myself. I just want to be better than what I was before.',
    said: 'Olympics.com 인터뷰',
    source: 'https://www.olympics.com/en/news/sarah-sjostrom-challenge-mentality-domination',
    photo: { by: 'Larske', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Sarah_Sjöström_2013_(cropped).jpg' },
  },
  {
    kind: 'athlete',
    id: 'hwang',
    name: '황선우',
    note: '대한민국 · 자유형',
    text: '나는 옆 레인의 누군가를 이겨야겠다는 생각보다 항상 내 기록을 깨려고 노력했다.',
    said: '2022년 일간스포츠 인터뷰',
    source: 'https://isplus.com/article/view/isp202209260026',
    photo: { by: 'OSEN SPORTS', license: 'CC BY 3.0', source: 'https://commons.wikimedia.org/wiki/File:황선우_수영_선수.jpg' },
  },
  {
    kind: 'athlete',
    id: 'kim',
    name: '김우민',
    note: '대한민국 · 자유형 중장거리',
    text: '포기하지 않고 매 순간 노력하면 다 이뤄낼 수 있다.',
    said: '2024년 파리올림픽 동메달 뒤',
    source: 'https://www.khan.co.kr/article/202408052000001',
    photo: { by: 'KOCIS · 김선주', license: 'CC BY-SA 2.0', source: 'https://commons.wikimedia.org/wiki/File:Hangzhou_AsianGames_Team_Korea_05_-_Kim_Woo-min_(cropped).jpg' },
  },
  {
    // 널리 도는 「신은 넘을 수 없는 시련은 주지 않는다」 는 넣지 않았다. 일본에서
    // 오래 쓰인 관용구이고, 본인의 말로 보도된 1차 출처를 찾지 못했다. 대신 백혈병
    // 공표 석 달 뒤 본인 성명에서 나온 문장을 쓴다 — 영어 보도 두 곳이 같은 문장을 싣는다.
    kind: 'athlete',
    id: 'ikee',
    name: '이케에 리카코',
    note: '일본 · 접영/자유형 단거리',
    text: '지지 않겠다고, 병을 이겨낼 수 있을 때까지 견디겠다고 스스로에게 약속합니다.',
    original:
      'I promise myself I will not be defeated and will endure until I am able to overcome my illness.',
    said: '2019년 5월 본인 성명 (백혈병 투병 중)',
    source: 'https://www.olympics.com/en/news/rikako-ikee-update-cancer-leukaemia-emotional-statement',
    photo: { by: '江戸村のとくぞう', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Rikako_Ikee_20230408a.jpg' },
  },
  {
    // 사진이 없다. 위키미디어 공용에 자유 라이선스 사진이 한 장도 없고, 돌아다니는
    // 사진은 전부 통신사 소유다. 화면은 이름 첫 글자를 원 안에 넣는다.
    kind: 'athlete',
    id: 'mcintosh',
    name: '서머 매킨토시',
    note: '캐나다 · 개인혼영/접영',
    text: '나는 늘 나를 더 낫게 만들 방법을 생각합니다. 내가 어떻게 해볼 수 있는 건 그것뿐이니까요.',
    original:
      'I always [am] just thinking about ways I can improve myself, because that\'s all I can really control.',
    said: 'Olympics.com 인터뷰',
    source: 'https://www.olympics.com/en/news/summer-mcintosh-2026-pan-pacific-championships-training',
  },
  {
    // 매킨토시와 같은 이유로 사진이 없다. 시드니 2000 의 그 유명한 사진은 통신사
    // 것이고 위키미디어 공용에는 이 선수 파일이 한 장도 없다.
    //
    // 이 카드가 이 앱에 가장 어울린다 — 13m 짜리 호텔 수영장에서 주 3시간 훈련하고
    // 올림픽에 선 사람의 말이다.
    kind: 'athlete',
    id: 'moussambani',
    name: '에릭 무삼바니',
    note: '적도기니 · 자유형 · 시드니 2000',
    text: '학교를 마치고 수영을 시작했습니다. 수영장이 없었어요. 아무것도 없었죠. 그래서 길이가 13미터쯤 되는 호텔 개인 수영장에 가서 훈련했습니다.',
    original:
      'I started swimming when I left school. We didn’t have a swimming pool. We didn’t have anything, and I went to train at a private hotel pool that was about 13 metres long I think.',
    said: 'Olympics.com 인터뷰',
    source: 'https://www.olympics.com/en/news/eric-moussambani-sydney-2000-changed-my-life',
  },

  // ---------------------------------------------------------------------
  // 지은이 없는 문구. 실존 인물에게 귀속시키지 않으므로 출처도 사진도 없다.
  // 카드가 다르게 생겼다(`view.ts` · `.quote.saying`).
  // ---------------------------------------------------------------------
  {
    kind: 'saying',
    id: 'calling',
    text: 'The water is calling, and I must swim',
    korean: '물이 부른다. 나는 가야 한다.',
  },
  {
    kind: 'saying',
    id: 'meditation',
    text: 'Swimming is simply moving meditation',
    korean: '수영은 그저 움직이는 명상이다.',
  },
  {
    kind: 'saying',
    id: 'live-love-swim',
    text: 'Live, Love, Swim',
    korean: '살고, 사랑하고, 헤엄쳐라.',
  },
  {
    kind: 'saying',
    id: 'chlorine',
    text: 'Chlorine is my perfume',
    korean: '염소 냄새가 내 향수다.',
  },

  // ---------------------------------------------------------------------
  // 아래 셋은 회원이 알려준 문장이다. 사진은 라이선스를 확인했지만 **문장의
  // 1차 출처를 찾지 못했다** — `source` 가 비어 있고 화면이 '출처 미확인'이라고 밝힌다.
  // 출처가 나오면 `source` 만 채우면 표시가 바뀐다.
  // ---------------------------------------------------------------------
  {
    kind: 'athlete',
    id: 'park',
    name: '박태환',
    note: '대한민국 · 자유형 중장거리',
    text: '다시 수영이 재밌어졌다.',
    said: '회원 제공',
    photo: { by: 'JD Lasica', license: 'CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:400_meter_freestyle_(6404091897)_Park.jpg' },
  },
  {
    kind: 'athlete',
    id: 'milak',
    name: '크리스토프 밀라크',
    note: '헝가리 · 접영',
    text: '나는 메달을 위해 헤엄친 게 아니라 기록을 위해 헤엄쳤다.',
    original: "I didn't swim for the medal, but for the time.",
    said: '회원 제공',
    photo: { by: 'Martin Rulsch', license: 'CC BY-SA 4.0', source: "https://commons.wikimedia.org/wiki/File:2018-10-07_Swimming_Boys'_400_m_Freestyle_Final_at_2018_Summer_Youth_Olympics_(Martin_Rulsch)_45.jpg" },
  },
]

/**
 * 접속할 때마다 하나를 고른다.
 *
 * `random` 을 밖에서 받는 이유는 테스트 때문이다 — 고르는 규칙을 검사하려면
 * 난수가 인자여야 한다.
 */
export function pickQuote(random: number = Math.random()): Quote {
  const index = Math.floor(random * QUOTES.length)
  // random 이 1 이면(이론상) 범위를 넘는다. 마지막 항목으로 눌러 담는다.
  return QUOTES[Math.min(index, QUOTES.length - 1)]!
}
