import { describe, expect, test } from 'bun:test'
import { pickQuote, QUOTES } from './quotes'

describe('어록 데이터 무결성', () => {
  test('아이디가 겹치지 않는다', () => {
    const ids = QUOTES.map((quote) => quote.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // 지어낸 문장이 섞이지 않게 하는 최소한의 자물쇠다. 출처 없이 들어온 어록은 여기서 걸린다.
  test('모든 어록에 출처 주소가 있다', () => {
    for (const quote of QUOTES) {
      expect(quote.source).toStartWith('https://')
      expect(quote.said.length).toBeGreaterThan(0)
      expect(quote.text.length).toBeGreaterThan(10)
    }
  })

  // CC BY 계열은 저작자 표시가 라이선스 **조건**이다. 비면 조건 위반이 된다.
  test('모든 사진에 저작자와 라이선스와 원본 주소가 있다', () => {
    for (const quote of QUOTES) {
      expect(quote.photoBy.length).toBeGreaterThan(0)
      expect(quote.photoLicense).toMatch(/^(CC|Public domain)/)
      expect(quote.photoSource).toStartWith('https://commons.wikimedia.org/')
    }
  })

  // 인용구 모음 사이트는 1차 출처가 없고 오귀속이 흔하다(`quotes.ts` 머리말).
  test('출처가 인용구 모음 사이트가 아니다', () => {
    for (const quote of QUOTES) {
      expect(quote.source).not.toContain('brainyquote')
      expect(quote.source).not.toContain('goodreads')
      expect(quote.source).not.toContain('azquotes')
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

  test('사진 파일이 실제로 있다', async () => {
    for (const quote of QUOTES) {
      const file = Bun.file(`web/quotes/${quote.id}.jpg`)
      expect(await file.exists()).toBe(true)
    }
  })

  // 오프라인에서 빈칸이 뜨지 않으려면 서비스워커가 전부 캐시해야 한다.
  test('서비스워커 셸에 모든 사진이 들어 있다', async () => {
    const sw = await Bun.file('src/sw.ts').text()
    for (const quote of QUOTES) expect(sw).toContain(`./quotes/${quote.id}.jpg`)
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
