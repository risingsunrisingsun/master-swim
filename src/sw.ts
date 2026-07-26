/**
 * 앱 셸 캐시.
 *
 * 수영장에는 와이파이가 없다. 첫 방문 이후로는 네트워크 없이 떠야 한다.
 *
 * import/export 를 두지 않아 번들 결과가 클래식 워커로 그대로 동작한다.
 * 그 대가로 이 파일은 전역 스크립트라 `self` 가 DOM 의 Window 로 잡히므로,
 * 재선언 대신 별칭으로 좁힌다.
 */
const sw = globalThis as unknown as ServiceWorkerGlobalScope

/** 배포할 때마다 올린다. 값이 바뀌면 옛 캐시가 정리된다. */
const CACHE = 'masters-swim-v3'

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
