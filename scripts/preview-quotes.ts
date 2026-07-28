/**
 * 어록 카드를 한 장에 모아 눈으로 확인하는 미리보기. 저장소 루트에서:
 *   bun scripts/preview-quotes.ts && bun run serve
 * 그리고 http://localhost:5173/_preview.html 을 연다.
 *
 * 앱에서는 접속마다 한 장만 뜨므로 사진 없는 카드·출처 미확인 카드를 확인하려면
 * 새로고침을 반복해야 한다. 이 파일이 그 수고를 없앤다. 산출물은 `dist/` 안이라
 * 배포에는 같이 올라가지만 링크가 어디에도 없다.
 */
import { QUOTES } from '../src/quotes'
import { quoteHtml } from '../src/view'

const css = await Bun.file('web/styles.css').text()
const cards = QUOTES.map(quoteHtml).join('\n')

const page =
  '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  `<style>${css}</style></head><body><main>${cards}</main></body></html>`

await Bun.write('dist/_preview.html', page)
console.log(`어록 ${QUOTES.length}장 · 사진 있는 것 ${QUOTES.filter((q) => q.photo).length}장`)
