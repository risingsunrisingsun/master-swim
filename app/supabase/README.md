# Supabase 연결 (v2 운영 모드)

설정이 없으면 앱은 **데모 모드**로 뜬다(ADR-0010). 실제 회원이 쓰려면 아래를 한 번 한다.
대시보드 작업은 사람이 해야 한다 — 계정 생성과 키 발급은 자동화하지 않는다.

## 1. 프로젝트 만들기

1. <https://supabase.com> 에서 무료 프로젝트를 만든다. 지역은 **Northeast Asia (Seoul)**.
2. **Authentication → Sign In / Providers → Email**
   - **Confirm email 끄기** — 내부 주소로는 메일이 가지 않는다(ADR-0011).
   - **Allow new users to sign up 끄기** — 가입은 Edge Function 만 한다. 켜 두면 anon 키로
     누구나 Auth 사용자를 만들 수 있다(members 행이 없어 아무것도 못 보지만, 쓰레기가 쌓인다).

## 2. 스키마

**SQL Editor** 에 `migrations/` 의 파일을 번호 순서대로 하나씩 통째로 붙여 실행한다.

- `0001_members_meetings_attendance.sql` — 테이블 · RLS · 함수
- `0002_table_grants.sql` — 테이블 권한. 빠뜨리면 Edge Function 이 `permission denied` 로
  막혀 가입이 「잠시 후 다시 시도해 주세요」(500)로만 끝난다.
- `0003_records_goals_sets.sql` — 기록 · 목표 · 세트 코치 조정 테이블과 `save_meeting_records`.
  **앱을 배포하기 전에** 실행한다. 없으면 홈 · 기록 · 세트 화면이 「저장하지 못했습니다」로 막힌다.
- `0004_member_profile.sql` — 회원 성별 · 출생연도(운영자가 넣는 선택값). 이것도 배포 전에.
- `0005_meeting_custom_label.sql` — 모임 종류 직접 입력(`kind = 'custom'` + `label`). 배포 전에.
- `0006_rsvps.sql` — 회원이 미리 하는 참석 여부 답(`rsvps`, `set_rsvp`). 출석과 별개. 배포 전에.

## 3. Edge Function

Supabase CLI 로 배포한다. 이 함수는 **로그인 전에** 불리므로 JWT 검사를 끈다.

```sh
npx supabase login
npx supabase functions deploy redeem-invite --project-ref <프로젝트 ref> --no-verify-jwt
npx supabase functions deploy set-passwords --project-ref <프로젝트 ref> --no-verify-jwt
```

`set-passwords` 는 운영자가 회원 비밀번호를 직접 정하는 함수다(일괄 추가 · 회원 정보 화면).
로그인한 운영자만 부를 수 있고, 그 검사는 함수 안에서 한다 — 게이트웨이 JWT 검사를 끈 이유는
redeem-invite 와 같게 두기 위해서이고, 토큰 없이 부르면 401 이다.

`SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` 는 Supabase 가 함수에 자동으로 넣는다.
내부 이메일 도메인을 바꾸려면 **Edge Functions → Secrets** 에 `AUTH_EMAIL_DOMAIN` 을 둔다
(기본 `members.nineteen.invalid`).

> **확인 필요** — Supabase Auth 가 `.invalid` 도메인을 거절하면 가입이 500 으로 실패한다.
> 그때는 `AUTH_EMAIL_DOMAIN` 을 운영자가 소유한 도메인의 하위 도메인으로 바꾼다.
> 메일은 보내지 않으므로 MX 설정은 필요 없다.

## 4. 첫 운영자

앱에서는 운영자를 만들 수 없다(운영자가 있어야 회원을 만든다). SQL Editor 에서:

```sql
insert into members (display_name, role, status) values ('운영자이름', 'admin', 'invited');
```

`issue_invite` 는 운영자 로그인을 요구하므로 첫 코드만 직접 만든다:

```sql
-- 'ABCD2345' 를 원하는 8자로 바꾼다. 알파벳: ABCDEFGHJKMNPQRSTUVWXYZ23456789
insert into invites (code_hash, member_id, expires_at)
select encode(extensions.digest('ABCD2345', 'sha256'), 'hex'), id, now() + interval '7 days'
from members where display_name = '운영자이름';
```

앱의 **초대코드로 가입**에서 그 코드로 비밀번호를 정하면 운영자로 들어온다.
그 다음부터 회원 추가 · 초대코드 발급은 앱의 **운영 → 회원**에서 한다.

## 5. 빌드에 키 넣기

**Project Settings → API** 의 Project URL 과 anon(public) 키.

```sh
NINETEEN_SUPABASE_URL=https://<ref>.supabase.co NINETEEN_SUPABASE_ANON_KEY=<anon key> bun run app:build
```

anon 키는 공개돼도 된다 — RLS 가 지킨다. **service_role 키는 앱·저장소 어디에도 넣지 않는다.**

### GitHub Pages 배포

main 에 푸시하면 `.github/workflows/deploy.yml` 이 v1 과 함께 `app/` 아래로 배포한다
(<https://risingsunrisingsun.github.io/master-swim/app/>). 키는 저장소
**Settings → Secrets and variables → Actions → Variables** 의
`NINETEEN_SUPABASE_URL` · `NINETEEN_SUPABASE_ANON_KEY` 에서 읽는다. 비어 있으면 배포가 멈춘다.

## 무료 티어 주의

1주일 동안 요청이 없으면 프로젝트가 일시정지된다. 방학처럼 쉬는 달 뒤에는 대시보드에서
**Restore** 를 눌러야 한다(ADR-0010).
