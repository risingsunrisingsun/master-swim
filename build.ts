/**
 * dist/ 를 만든다. web/ 을 그대로 복사하고 src/ 를 그 위에 번들한다.
 *
 * GitHub Pages 는 /<repo>/ 하위 경로로 서빙하므로 산출물의 모든 참조는 상대경로여야 한다.
 * (index.html · manifest · 서비스워커 등록 전부 './' 로 시작한다)
 */
import { cp, rm } from 'node:fs/promises'

const OUT = 'dist'

await rm(OUT, { recursive: true, force: true })
await cp('web', OUT, { recursive: true })

const result = await Bun.build({
  entrypoints: ['src/main.ts', 'src/sw.ts'],
  outdir: OUT,
  target: 'browser',
  format: 'esm',
  minify: true,
  // 서비스워커는 클래식 스크립트로 등록되므로 공유 청크가 생기면 안 된다.
  splitting: false,
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

// Jekyll 이 밑줄로 시작하는 파일을 걸러내지 않도록 끈다.
await Bun.write(`${OUT}/.nojekyll`, '')

console.log(`빌드 완료 → ${OUT}/`)
for (const output of result.outputs) console.log(`  ${output.path.split(/[\\/]/).pop()}`)
