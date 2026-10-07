/**
 * app/dist/ 를 서빙하는 개발용 서버. 해시 라우팅이라 index.html 하나면 된다.
 */
const ROOT = `${import.meta.dir}/dist`
const port = Number(process.env.PORT ?? 5174)

Bun.serve({
  port,
  async fetch(request) {
    const { pathname } = new URL(request.url)
    const file = Bun.file(`${ROOT}${pathname === '/' ? '/index.html' : decodeURIComponent(pathname)}`)
    if (await file.exists()) return new Response(file)
    return new Response('없는 파일입니다. bun run app:build 를 먼저 실행하세요.', { status: 404 })
  },
})

console.log(`http://localhost:${port}`)
