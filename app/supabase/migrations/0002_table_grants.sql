-- 테이블 권한 (0001 보완)
--
-- 최근 Supabase 프로젝트는 SQL 로 만든 public 테이블에 anon · authenticated · service_role
-- 권한을 자동으로 주지 않는다. 권한이 없으면 RLS 이전에 "permission denied"(42501)로 막힌다.
-- service_role 도 RLS 만 넘을 뿐 GRANT 는 넘지 못한다 — Edge Function 이 초대코드를 못 읽는다.
--
-- 여기서는 "테이블에 손댈 수 있는가"만 연다. "어느 행인가"는 0001 의 RLS 가 정한다.

-- Edge Function(redeem-invite)
grant select, insert, update, delete on public.members, public.invites, public.meetings, public.attendance
  to service_role;

-- 로그인한 회원 · 운영자. 행 범위는 RLS 정책이 자른다.
grant select, insert, update on public.members to authenticated;
grant select, insert, update, delete on public.meetings to authenticated;
-- 출석 쓰기는 save_attendance(security definer)로만 한다.
grant select on public.attendance to authenticated;
-- invites: authenticated · anon 에게 주지 않는다. 발급은 issue_invite, 사용은 Edge Function.

-- anon: 테이블 권한 없음. 로그인 전에는 login_email 함수만 부른다(0001 에서 grant).
