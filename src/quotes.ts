/**
 * 선수 어록. 메뉴 화면 아래 빈자리에 접속할 때마다 하나씩 뜬다.
 *
 * 두 가지를 지킨다.
 *
 * **어록은 지어내지 않는다.** 실존 인물이 하지 않은 말을 그 사람 이름으로 띄우는 것은
 * 오귀속이다. 여기 있는 문장은 전부 1차에 가까운 출처(본인 인터뷰 기사·연설 보도)에서
 * 원문을 확인한 것이고, `source` 에 그 주소가 있다. BrainyQuote·Goodreads 같은 인용구
 * 모음 사이트는 출처로 쓰지 않았다 — 오귀속이 흔하다.
 *
 * **사진은 라이선스를 확인한 것만 쓴다.** 전부 위키미디어 공용에서 받았고 파일마다
 * 촬영자와 라이선스가 명시돼 있다. CC BY 계열은 저작자 표시가 조건이므로
 * `photoBy`·`photoLicense` 를 화면에 **반드시 함께 띄운다**(`view.ts`).
 * 구글 이미지 검색의 '사용 권한' 필터는 라이선스를 보증하지 않아 쓰지 않았다.
 *
 * 사진 파일은 `web/quotes/<id>.jpg` 다. 원본과 잘라내기 좌표는
 * `assets/quotes/` 와 `scripts/make-quote-photos.ps1` 에 있다.
 *
 * 추가하려면: 출처가 확인되는 문장 + 자유 라이선스 사진이 **둘 다** 있어야 한다.
 * 하나만 있으면 넣지 않는다. (예 — 이케에 리카코는 사진은 받아 뒀지만
 * 백혈병 공표 당시 발언의 원문을 1차 출처에서 확인하지 못해 `assets/quotes-pending/`
 * 에 두고 넣지 않았다.)
 */

export interface Quote {
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
  readonly source: string
  /** 사진 저작자와 라이선스. CC BY 계열의 조건이므로 화면에 함께 뜬다. */
  readonly photoBy: string
  readonly photoLicense: string
  /** 위키미디어 공용 파일 페이지 — 라이선스 원문을 확인할 수 있는 곳 */
  readonly photoSource: string
}

export const QUOTES: readonly Quote[] = [
  {
    id: 'phelps',
    name: '마이클 펠프스',
    note: '미국 · 접영/개인혼영',
    text: '꿈은 얼마든지 크게 꾸세요. 정말이지, 꿀 수 있는 만큼 크게.',
    original: "Don't be afraid to dream as big as you possibly can. I mean, absolutely as big as you can.",
    said: '2021년 온라인 행사',
    source:
      'https://www.olympics.com/en/news/michael-phelps-don-t-be-afraid-to-dream-as-big-as-you-possibly-can',
    photoBy: 'Agência Brasil Fotografias',
    photoLicense: 'CC BY 2.0',
    photoSource: 'https://commons.wikimedia.org/wiki/File:Michael_Phelps_Rio_Olympics_2016.jpg',
  },
  {
    id: 'ledecky',
    name: '케이티 러데키',
    note: '미국 · 자유형 장거리',
    text: '자기 레이스에서 이기면 됩니다. 그리고 자기 레이스에서 이긴다는 건 시상대가 아니라 과정을 사랑하게 되는 것입니다.',
    original:
      'You just need to win your race. And winning your race means falling in love with the process, not the podium.',
    said: '스탠퍼드대 졸업식 연설',
    source:
      'https://www.olympics.com/en/news/katie-ledecky-gen-z-set-goals-but-you-dont-have-to-achieve-them',
    photoBy: 'Mledecky',
    photoLicense: 'CC0',
    photoSource:
      'https://commons.wikimedia.org/wiki/File:Katie_Ledecky_at_the_2023_Golden_Goggle_Awards.jpg',
  },
  {
    id: 'dressel',
    name: '케일럽 드레슬',
    note: '미국 · 자유형/접영 단거리',
    text: '나는 매일 오늘 더 나아지러 왔다는 마음으로 훈련에 나갑니다.',
    original: "I come to practice every day with the mindset that I'm there to get better.",
    said: 'Olympics.com 단독 인터뷰',
    source:
      'https://www.olympics.com/en/news/caeleb-dressel-exclusive-critic-mentality-joy-chaos-parenthood-swimming-interview',
    photoBy: 'JD Lasica',
    photoLicense: 'CC BY 2.0',
    photoSource:
      'https://commons.wikimedia.org/wiki/File:Caeleb_Dressel_before_winning_100_fly_(42769914221)_(cropped).jpg',
  },
  {
    id: 'thorpe',
    name: '이언 소프',
    note: '호주 · 자유형',
    text: '경기에 들어갈 때마다 나는 내 안에서 가장 좋은 것을 꺼내려고 합니다.',
    original: 'Every time I go into a swimming race I try to get the best out of myself.',
    said: '2000년 시드니 올림픽 직후 인터뷰',
    source:
      'https://www.swimmingworldmagazine.com/news/olympic-quotes-from-australian-superstar-ian-thorpe/',
    photoBy: 'Doha Stadium Plus Qatar',
    photoLicense: 'CC BY 2.0',
    photoSource: 'https://commons.wikimedia.org/wiki/File:Ian_Thorpe_2012.jpg',
  },
  {
    id: 'sjostrom',
    name: '사라 셰스트룀',
    note: '스웨덴 · 접영/자유형 단거리',
    text: '나는 나를 나하고만 비교합니다. 예전의 나보다 나아지고 싶을 뿐입니다.',
    original:
      'I just like to compare myself to myself. I just want to be better than what I was before.',
    said: 'Olympics.com 인터뷰',
    source: 'https://www.olympics.com/en/news/sarah-sjostrom-challenge-mentality-domination',
    photoBy: 'Larske',
    photoLicense: 'CC BY-SA 4.0',
    photoSource: 'https://commons.wikimedia.org/wiki/File:Sarah_Sjöström_2013_(cropped).jpg',
  },
  {
    id: 'hwang',
    name: '황선우',
    note: '대한민국 · 자유형',
    text: '나는 옆 레인의 누군가를 이겨야겠다는 생각보다 항상 내 기록을 깨려고 노력했다.',
    said: '2022년 일간스포츠 인터뷰',
    source: 'https://isplus.com/article/view/isp202209260026',
    photoBy: 'OSEN SPORTS',
    photoLicense: 'CC BY 3.0',
    photoSource: 'https://commons.wikimedia.org/wiki/File:황선우_수영_선수.jpg',
  },
  {
    id: 'kim',
    name: '김우민',
    note: '대한민국 · 자유형 중장거리',
    text: '포기하지 않고 매 순간 노력하면 다 이뤄낼 수 있다.',
    said: '2024년 파리올림픽 동메달 뒤',
    source: 'https://www.khan.co.kr/article/202408052000001',
    photoBy: 'KOCIS · 김선주',
    photoLicense: 'CC BY-SA 2.0',
    photoSource:
      'https://commons.wikimedia.org/wiki/File:Hangzhou_AsianGames_Team_Korea_05_-_Kim_Woo-min_(cropped).jpg',
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
