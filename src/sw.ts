/**
 * 앱 셸 캐시.
 *
 * 첫 방문 이후로는 네트워크가 끊겨도 떠야 한다. 수영장에 와이파이는 있지만
 * 탈의실·주차장에서 끊기고, 폰 데이터를 아끼는 회원도 있다. 앱 셸이 캐시에 있으면
 * 그 전부가 해결된다.
 *
 * import/export 를 두지 않아 번들 결과가 클래식 워커로 그대로 동작한다.
 * 그 대가로 이 파일은 전역 스크립트라 `self` 가 DOM 의 Window 로 잡히므로,
 * 재선언 대신 별칭으로 좁힌다.
 */
const sw = globalThis as unknown as ServiceWorkerGlobalScope

/** 배포할 때마다 올린다. 값이 바뀌면 옛 캐시가 정리된다. */
const CACHE = 'masters-swim-v16'

const SHELL = [
  './',
  './index.html',
  './main.js',
  './styles.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './logo.png',
  // 사진이 없는 카드가 쓰는 팀 마크. 없으면 그 카드가 오프라인에서 빈칸이 된다.
  './mark.png',
  // 어록 사진. 접속할 때마다 무작위로 뽑히므로 전부 있어야 오프라인에서 빈칸이 안 뜬다.
  // 여덟 장 합쳐 60KB 남짓이다. `src/quotes.ts` 에서 `photo` 가 있는 항목과 짝이 맞아야
  // 한다 — 사진이 없는 선수는 여기에도 없다(화면이 이름 첫 글자를 그린다).
  './quotes/phelps.jpg',
  './quotes/ledecky.jpg',
  './quotes/dressel.jpg',
  './quotes/thorpe.jpg',
  './quotes/sjostrom.jpg',
  './quotes/hwang.jpg',
  './quotes/kim.jpg',
  './quotes/ikee.jpg',
  './quotes/park.jpg',
  './quotes/milak.jpg',
]

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => sw.skipWaiting()),
  )
})

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => sw.clients.claim()),
  )
})

sw.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached

      return fetch(event.request).then((response) => {
        // 성공한 동일 출처 응답만 캐시에 넣는다.
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
    }),
  )
})
