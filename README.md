# 마스터즈 수영 훈련 도구

목표기록에서 훈련 페이스와 세트를 계산하는 동호회용 정적 PWA.
서버 없이 브라우저에서 전부 돌고, 입력값은 기기 밖으로 나가지 않는다.

설계 배경은 [`CONTEXT.md`](./CONTEXT.md), 결정 근거는 [`docs/adr/`](./docs/adr) 에 있다.

## 명령

```sh
bun install
bun run build      # dist/ 생성
bun run serve      # 빌드 후 http://localhost:5173
bun test           # 페이스 엔진 테스트
bun run typecheck
```

`main` 에 push 하면 GitHub Actions 가 typecheck → test → build 를 거쳐
GitHub Pages 로 배포한다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `src/pace.ts` | 목표 페이스 엔진. 순수 함수만 — DOM·저장소·네트워크 참조 없음 |
| `src/types.ts` | 종목·거리·등급의 정의 |
| `src/storage.ts` | localStorage 래퍼 + JSON 내보내기/가져오기 |
| `src/main.ts` | 화면 조립과 서비스워커 등록 |
| `src/sw.ts` | 앱 셸 캐시 (오프라인 동작) |
| `web/` | 정적 자산. `dist/` 로 그대로 복사된다 |
| `build.ts` | `web/` 복사 + `src/` 번들 |

## 최초 배포 절차

1. GitHub 에 **공개** 저장소를 만든다 (무료 티어 Pages 는 공개 저장소를 요구한다).
2. `git remote add origin <URL>` 후 `main` 을 push.
3. 저장소 **Settings → Pages → Source** 를 **GitHub Actions** 로 설정.
4. Actions 탭에서 배포 완료를 확인하고 `https://<계정>.github.io/<저장소>/` 를 연다.

## 배포 전 확인

- [ ] PWA 아이콘 PNG (192·512) 추가 — iOS 홈화면 아이콘은 SVG 를 받지 않는다
- [ ] `src/sw.ts` 의 `CACHE` 버전을 올렸는지 (안 올리면 옛 캐시가 남는다)
- [ ] 모든 자산 참조가 상대경로(`./`)인지 — Pages 는 하위 경로로 서빙한다
