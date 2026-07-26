/**
 * dist/ 를 정적으로 서빙하는 개발 서버.
 *
 * `bun <dir>` 은 디렉터리를 스크립트로 찾으므로 쓸 수 없다.
 * GitHub Pages 와 마찬가지로 확장자 없는 경로는 index.html 로 떨어진다.
 */
const ROOT = 'dist'
const port = Number(process.env.PORT ?? 5173)

Bun.serve({
  port,
  async fetch(request) {
    const { pathname } = new URL(request.url)
    const relative = pathname === '/' ? '/index.html' : pathname

    const file = Bun.file(`${ROOT}${relative}`)
    if (await file.exists()) return new Response(file)

    const fallback = Bun.file(`${ROOT}/index.html`)
    if (await fallback.exists()) return new Response(fallback)

    return new Response('dist/ 가 없습니다. bun run build 를 먼저 실행하세요.', { status: 404 })
  },
})

console.log(`http://localhost:${port}`)
