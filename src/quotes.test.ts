import { describe, expect, test } from 'bun:test'
import { type AthleteQuote, pickQuote, QUOTES, type Saying } from './quotes'

const athletes = QUOTES.filter((quote): quote is AthleteQuote => quote.kind === 'athlete')
const sayings = QUOTES.filter((quote): quote is Saying => quote.kind === 'saying')

describe('카드 데이터 무결성', () => {
  test('아이디가 겹치지 않는다', () => {
    const ids = QUOTES.map((quote) => quote.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('두 종류가 모두 들어 있다', () => {
    expect(athletes.length).toBeGreaterThan(0)
    expect(sayings.length).toBeGreaterThan(0)
    expect(athletes.length + sayings.length).toBe(QUOTES.length)
  })

  test('모든 카드에 문장이 있다', () => {
    for (const quote of QUOTES) expect(quote.text.length).toBeGreaterThan(10)
  })
})

describe('선수 어록', () => {
  test('이름과 어디서 한 말인지가 있다', () => {
    for (const quote of athletes) {
      expect(quote.name.length).toBeGreaterThan(0)
      expect(quote.said.length).toBeGreaterThan(0)
    }
  })

  // 지어낸 문장이 섞이지 않게 하는 자물쇠다. 출처가 있으면 진짜 주소여야 하고,
  // 없으면 화면이 '출처 미확인'을 띄운다 — 어중간한 문자열이 들어올 자리가 없다.
  test('출처가 있으면 http 주소다', () => {
    for (const quote of athletes) {
      if (quote.source !== undefined) expect(quote.source).toStartWith('https://')
    }
  })

  // 확인한 것과 아닌 것이 섞여 있다는 사실 자체가 이 파일의 성질이다(ADR-0009).
  test('출처가 확인된 어록이 절반을 넘는다', () => {
    const verified = athletes.filter((quote) => quote.source !== undefined).length
    expect(verified).toBeGreaterThan(athletes.length / 2)
  })

  // 인용구 모음 사이트는 1차 출처가 없고 오귀속이 흔하다(`quotes.ts` 머리말).
  test('출처가 인용구 모음 사이트가 아니다', () => {
    for (const quote of athletes) {
      for (const bad of ['brainyquote', 'goodreads', 'azquotes', 'quotefancy', 'enquoted']) {
        expect(quote.source ?? '').not.toContain(bad)
      }
    }
  })

  test('번역한 어록에는 원문이 함께 있다', () => {
    for (const quote of athletes) {
      if (quote.original !== undefined) expect(quote.original.length).toBeGreaterThan(10)
    }
    expect(athletes.filter((quote) => quote.original !== undefined).length).toBeGreaterThan(0)
  })

  // 없는 출처를 그럴듯한 링크로 채우지 않는다는 결정이 코드에 남아 있어야 한다(ADR-0009).
  test('출처 없이도 목록에 들어갈 수 있다', () => {
    expect(athletes.some((quote) => quote.source === undefined)).toBe(true)
  })
})

describe('사진', () => {
  // CC BY 계열은 저작자 표시가 라이선스 **조건**이다. 비면 조건 위반이 된다.
  test('사진이 있으면 저작자와 라이선스와 원본 주소가 모두 있다', () => {
    for (const quote of athletes) {
      if (!quote.photo) continue
      expect(quote.photo.by.length).toBeGreaterThan(0)
      expect(quote.photo.license).toMatch(/^(CC|Public domain)/)
      expect(quote.photo.source).toStartWith('https://commons.wikimedia.org/')
    }
  })

  test('사진이 있다고 적힌 선수는 파일도 실제로 있다', async () => {
    for (const quote of athletes) {
      if (!quote.photo) continue
      expect(await Bun.file(`web/quotes/${quote.id}.jpg`).exists()).toBe(true)
    }
  })

  // 없는 사진을 아무거나 채워 넣지 않는다는 결정이 코드에 남아 있어야 한다(ADR-0009).
  test('사진 없이도 목록에 들어갈 수 있다', () => {
    expect(athletes.some((quote) => quote.photo === undefined)).toBe(true)
  })

  // 오프라인에서 빈칸이 뜨지 않으려면 서비스워커가 전부 캐시해야 한다.
  // 반대로 없는 파일을 셸에 넣으면 addAll 이 통째로 실패해 캐시가 비어버린다.
  test('서비스워커 셸이 사진 목록과 정확히 짝이 맞는다', async () => {
    const sw = await Bun.file('src/sw.ts').text()
    const inShell = [...sw.matchAll(/'\.\/quotes\/([a-z]+)\.jpg'/g)].map((match) => match[1])
    const withPhoto = athletes.filter((quote) => quote.photo).map((quote) => quote.id)
    expect(inShell.sort()).toEqual(withPhoto.sort())
  })
})

describe('지은이 없는 문구', () => {
  // 귀속시킬 사람이 없으므로 검증할 것도 없다. 대신 사람 이름이 섞여 들어오면 안 된다 —
  // 그건 선수 어록이고 출처 규칙을 받아야 한다.
  test('영어 원문과 한국어 옮김이 둘 다 있다', () => {
    for (const saying of sayings) {
      expect(saying.text.length).toBeGreaterThan(10)
      expect(saying.korean.length).toBeGreaterThan(3)
    }
  })

  test('한국어 옮김에 한글이 들어 있다', () => {
    for (const saying of sayings) expect(saying.korean).toMatch(/[가-힣]/)
  })
})

describe('pickQuote', () => {
  test('난수를 주면 결정적으로 고른다', () => {
    expect(pickQuote(0).id).toBe(QUOTES[0]!.id)
    expect(pickQuote(0.999).id).toBe(QUOTES.at(-1)!.id)
  })

  test('1 이 들어와도 범위를 넘지 않는다', () => {
    expect(pickQuote(1).id).toBe(QUOTES.at(-1)!.id)
  })

  test('모든 카드가 뽑힐 수 있다', () => {
    const picked = new Set(
      Array.from({ length: QUOTES.length }, (_, i) => pickQuote(i / QUOTES.length).id),
    )
    expect(picked.size).toBe(QUOTES.length)
  })
})
