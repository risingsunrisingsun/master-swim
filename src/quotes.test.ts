import { describe, expect, test } from 'bun:test'
import { pickQuote, QUOTES } from './quotes'

describe('어록 데이터 무결성', () => {
  test('아이디가 겹치지 않는다', () => {
    const ids = QUOTES.map((quote) => quote.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('모든 어록에 문장과 출처 설명이 있다', () => {
    for (const quote of QUOTES) {
      expect(quote.said.length).toBeGreaterThan(0)
      expect(quote.text.length).toBeGreaterThan(10)
    }
  })

  // 지어낸 문장이 섞이지 않게 하는 자물쇠다. 출처가 있으면 진짜 주소여야 하고,
  // 없으면 화면이 '출처 미확인'을 띄운다 — 어중간한 문자열이 들어올 자리가 없다.
  test('출처가 있으면 http 주소다', () => {
    for (const quote of QUOTES) {
      if (quote.source !== undefined) expect(quote.source).toStartWith('https://')
    }
  })

  // 확인한 것과 아닌 것이 섞여 있다는 사실 자체가 이 파일의 성질이다(ADR-0009).
  test('출처가 확인된 어록이 절반을 넘는다', () => {
    const verified = QUOTES.filter((quote) => quote.source !== undefined).length
    expect(verified).toBeGreaterThan(QUOTES.length / 2)
  })

  // CC BY 계열은 저작자 표시가 라이선스 **조건**이다. 비면 조건 위반이 된다.
  // 사진이 없는 선수는 있어도 되지만, 있으면 세 값이 모두 차 있어야 한다.
  test('사진이 있으면 저작자와 라이선스와 원본 주소가 모두 있다', () => {
    for (const quote of QUOTES) {
      if (!quote.photo) continue
      expect(quote.photo.by.length).toBeGreaterThan(0)
      expect(quote.photo.license).toMatch(/^(CC|Public domain)/)
      expect(quote.photo.source).toStartWith('https://commons.wikimedia.org/')
    }
  })

  // 인용구 모음 사이트는 1차 출처가 없고 오귀속이 흔하다(`quotes.ts` 머리말).
  test('출처가 인용구 모음 사이트가 아니다', () => {
    for (const quote of QUOTES) {
      for (const bad of ['brainyquote', 'goodreads', 'azquotes', 'quotefancy', 'enquoted']) {
        expect(quote.source ?? '').not.toContain(bad)
      }
    }
  })

  test('한국어가 아닌 어록에는 원문이 함께 있다', () => {
    for (const quote of QUOTES) {
      // 한글이 없는 이름 = 외국 선수라는 뜻이 아니다. 번역했다면 원문을 남긴다는 규칙만 본다.
      if (quote.original !== undefined) expect(quote.original.length).toBeGreaterThan(10)
    }
    // 적어도 몇 개는 번역이므로 원문이 있어야 한다.
    expect(QUOTES.filter((quote) => quote.original !== undefined).length).toBeGreaterThan(0)
  })

  test('사진이 있다고 적힌 선수는 파일도 실제로 있다', async () => {
    for (const quote of QUOTES) {
      if (!quote.photo) continue
      expect(await Bun.file(`web/quotes/${quote.id}.jpg`).exists()).toBe(true)
    }
  })

  // 오프라인에서 빈칸이 뜨지 않으려면 서비스워커가 전부 캐시해야 한다.
  // 반대로 사진 없는 선수를 셸에 넣으면 addAll 이 통째로 실패해 캐시가 비어버린다.
  test('서비스워커 셸이 사진 목록과 정확히 짝이 맞는다', async () => {
    const sw = await Bun.file('src/sw.ts').text()
    const inShell = [...sw.matchAll(/'\.\/quotes\/([a-z]+)\.jpg'/g)].map((match) => match[1])
    const withPhoto = QUOTES.filter((quote) => quote.photo).map((quote) => quote.id)
    expect(inShell.sort()).toEqual(withPhoto.sort())
  })
})

describe('사진이 없는 선수', () => {
  // 없는 사진을 아무거나 채워 넣지 않는다는 결정이 코드에 남아 있어야 한다(ADR-0009).
  test('사진 없이도 목록에 들어갈 수 있다', () => {
    expect(QUOTES.some((quote) => quote.photo === undefined)).toBe(true)
  })

})

describe('출처가 확인되지 않은 어록', () => {
  // 없는 출처를 그럴듯한 링크로 채우지 않는다는 결정이 코드에 남아 있어야 한다(ADR-0009).
  test('출처 없이도 목록에 들어갈 수 있다', () => {
    expect(QUOTES.some((quote) => quote.source === undefined)).toBe(true)
  })

  test('출처가 없으면 어디서 왔는지는 적혀 있다', () => {
    for (const quote of QUOTES.filter((q) => q.source === undefined)) {
      expect(quote.said.length).toBeGreaterThan(0)
    }
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

  test('모든 어록이 뽑힐 수 있다', () => {
    const picked = new Set(
      Array.from({ length: QUOTES.length }, (_, i) => pickQuote(i / QUOTES.length).id),
    )
    expect(picked.size).toBe(QUOTES.length)
  })
})
