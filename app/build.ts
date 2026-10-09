/**
 * v2 빌드. app/dist/ 를 만든다.
 *
 * app/web/ 을 복사하고, 팀 아이콘은 v1 의 web/ 에서 그대로 가져온다(같은 로고).
 * Supabase 주소와 anon 키는 환경변수에서 번들에 박아 넣는다 — 비어 있으면 데모 모드.
 *
 *   NINETEEN_SUPABASE_URL=https://xxxx.supabase.co NINETEEN_SUPABASE_ANON_KEY=... bun run app:build
 *
 * GitHub Pages 의 하위 경로로 서빙되므로 모든 참조는 상대경로('./')다.
 */
import { cp, rm } from 'node:fs/promises'

const HERE = import.meta.dir
const OUT = `${HERE}/dist`
const SHARED_ICONS = ['mark.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']

await rm(OUT, { recursive: true, force: true })
await cp(`${HERE}/web`, OUT, { recursive: true })
for (const name of SHARED_ICONS) await cp(`${HERE}/../web/${name}`, `${OUT}/${name}`)

const url = process.env.NINETEEN_SUPABASE_URL ?? ''
const anonKey = process.env.NINETEEN_SUPABASE_ANON_KEY ?? ''
// 네이버 로그인 Client ID(공개값). 비어 있으면 네이버 버튼 없이 빌드된다.
const naverClientId = process.env.NINETEEN_NAVER_CLIENT_ID ?? ''

const result = await Bun.build({
  entrypoints: [`${HERE}/src/main.ts`],
  outdir: OUT,
  target: 'browser',
  format: 'esm',
  minify: true,
  define: {
    __SUPABASE_URL__: JSON.stringify(url),
    __SUPABASE_ANON_KEY__: JSON.stringify(anonKey),
    __NAVER_CLIENT_ID__: JSON.stringify(naverClientId),
  },
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

await Bun.write(`${OUT}/.nojekyll`, '')

console.log(`빌드 완료 → app/dist/ (${url && anonKey ? 'Supabase' : '데모 모드'})`)
for (const output of result.outputs) {
  console.log(`  ${output.path.split(/[\\/]/).pop()}  ${(output.size / 1024).toFixed(0)}KB`)
}
