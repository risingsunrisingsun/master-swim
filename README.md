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
| `src/grading.ts` | 등급 배정. 기록 축(강도) × 훈련량 축(분량) |
| `src/methods.ts` | 훈련방법 카탈로그 20개 + 등급별 파라미터 |
| `src/plan.ts` | 주간 플랜 배치. 목표 거리로 세션 구성을 결정 |
| `src/log.ts` | 훈련 로그와 목표 판정. 완주 개수 하나로 목표를 검증 (ADR-0007) |
| `src/nutrition.ts` | 식단. KDRIs 식사구성안 위에서만 계산 (ADR-0005) |
| `src/distributions.ts` | 국내 마스터즈 기록 분포. 그래프에서 읽은 히스토그램 원본 |
| `src/benchmark.ts` | 기록 위치. 분포가 있으면 실제 백분위, 없으면 등급 구간 (ADR-0006) |
| `src/dryland.ts` | 영법별 지상훈련 세트와 유튜브 링크. 처방 원본은 `methods.ts` |
| `src/terms.ts` | 수영 용어집과 퀴즈 생성기. 난수를 인자로 받아 테스트된다 |
| `src/quotes.ts` | 선수 어록. 출처와 사진 라이선스가 문장마다 붙어 있다 (ADR-0009) |
| `src/chart.ts` | 기록 추이 SVG. 라이브러리 없음, 계열 하나, y축 뒤집힘 |
| `src/view.ts` | HTML 생성. 순수 함수라 브라우저 없이 테스트된다 |
| `src/types.ts` | 종목·거리·등급의 정의 |
| `src/storage.ts` | localStorage 래퍼 + 스키마 마이그레이션 + JSON 내보내기 |
| `src/main.ts` | DOM 배선, 해시 라우팅, 서비스워커 등록 |
| `src/sw.ts` | 앱 셸 캐시 (오프라인 동작) |
| `web/` | 정적 자산. `dist/` 로 그대로 복사된다 |
| `build.ts` | `web/` 복사 + `src/` 번들 |
| `serve.ts` | 개발용 정적 서버 |

## 최초 배포 절차

1. GitHub 에 **공개** 저장소를 만든다 (무료 티어 Pages 는 공개 저장소를 요구한다).
2. 저장소 **Settings → Pages → Source** 를 **GitHub Actions** 로 설정한다.
   **이 단계는 자동화할 수 없다** — 워크플로의 `GITHUB_TOKEN` 은 admin 이 아니라
   Pages 를 켜는 API 를 호출하지 못한다. 건너뛰면 `configure-pages` 에서 실패한다.
3. `git remote add origin <URL>` 후 `main` 을 push.
4. Actions 탭에서 배포 완료를 확인하고 `https://<계정>.github.io/<저장소>/` 를 연다.

> 계정을 두 개 이상 쓰면 Git Credential Manager 가 `github.com` 하나에 자격증명을
> 하나만 들고 있어 다른 계정 저장소로 push 할 때 403 이 난다.
> `git config --global credential.useHttpPath true` 로 저장소별 자격증명을 쓰게 한다.

## 아이콘

`assets/logo-source.png` (팀 로고 배너)에서 잘라 만든다. 로고가 바뀌면 원본을
갈아끼우고 저장소 루트에서 다시 돌린다:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\make-icons.ps1
```

아이콘은 배너에서 **"19 + 물결" 부분만** 쓴다 — `NINETEEN` 워드마크는 192px 에서
읽히지 않는다. `icon-maskable-512.png` 는 안드로이드가 아이콘을 원형·둥근사각형으로
깎아도 잘리지 않도록 여백을 더 준 판이다. `logo.png` 는 시작 화면용이라 워드마크까지
포함한다 — 큰 화면에서는 읽히고, 팀을 알아보는 것이 시작 화면의 목적이다.

`logo.png` 만 **배경이 투명하다.** 원본은 흰 바탕에 파란 잉크이므로
`alpha = 255 − min(R,G,B)` 로 잉크 진하기를 얻고 흰색과 합성되기 전 색으로 되돌린다.
흰 배경을 그대로 두면 시작 화면의 회색 바탕 위에 흰 사각형이 떠 보인다.
아이콘 네 개는 흰 배경을 유지한다 — 마스커블 아이콘은 배경이 차 있어야 한다.

## 어록 사진

`web/quotes/*.jpg` 는 위키미디어 공용에서 받은 자유 라이선스 사진을 200px 정사각형으로
자른 것이다. 원본은 `assets/quotes/`, 잘라내기 좌표는 스크립트 안에 파일별로 들어 있다
(얼굴 위치가 달라 자동으로 맞출 수 없다):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\make-quote-photos.ps1
```

**저작자와 라이선스는 화면에 반드시 함께 뜬다** — CC BY 계열의 조건이다.
값은 `src/quotes.ts` 에 있고 `quotes.test.ts` 가 비어 있는지 검사한다.
어록을 추가하려면 출처가 확인되는 문장과 자유 라이선스 사진이 **둘 다** 필요하다(ADR-0009).

## 배포 전 확인

- [ ] `src/sw.ts` 의 `CACHE` 버전을 올렸는지 (안 올리면 옛 캐시가 남는다)
- [ ] 모든 자산 참조가 상대경로(`./`)인지 — Pages 는 하위 경로로 서빙한다
- [ ] 아이콘을 바꿨다면 `web/` 의 PNG 네 개가 모두 갱신됐는지
