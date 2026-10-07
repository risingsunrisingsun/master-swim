-- 나인틴 v2 — 회원 · 초대코드 · 정기모임 · 출석 (ADR-0010, ADR-0011)
--
-- 접근 제어는 전부 RLS 가 한다. 화면이 버튼을 숨기는 것은 보안이 아니다.
--   회원   : 자기 행만 읽는다. 모임 목록은 모두 읽는다.
--   운영자 : 전부 읽고 쓴다.
--   초대코드: 아무도 직접 읽지 못한다. 함수(issue_invite)와 Edge Function 만 만진다.

create extension if not exists pgcrypto with schema extensions;

-- ── 테이블 ────────────────────────────────────────────────────

create table public.members (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references auth.users (id) on delete set null,
  display_name text not null unique
               check (display_name = btrim(display_name) and length(display_name) between 1 and 30),
  role         text not null default 'member' check (role in ('member', 'admin')),
  status       text not null default 'invited' check (status in ('invited', 'active', 'inactive')),
  -- 이 날 이전 모임은 달성률 분모에 넣지 않는다.
  joined_on    date not null default current_date,
  created_at   timestamptz not null default now()
);

create table public.invites (
  -- 코드 원문은 저장하지 않는다. 발급 화면에 한 번 보이고 끝이다.
  code_hash  text primary key,
  member_id  uuid not null references public.members (id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create table public.meetings (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  kind       text not null check (kind in ('training', 'record')),
  place      text not null default '',
  cancelled  boolean not null default false,
  -- 출석을 저장한 시각. 비어 있으면 "집계 전" — 지난 모임이어도 분모에 넣지 않는다.
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index meetings_date on public.meetings (date);

-- 참석만 행으로 둔다. 결석은 "집계된 모임에 행이 없음"이다.
create table public.attendance (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  primary key (meeting_id, member_id)
);

create index attendance_member on public.attendance (member_id);

-- ── 권한 판정 ────────────────────────────────────────────────
-- security definer 로 members 를 읽는다. RLS 정책 안에서 members 를 다시 조회하면
-- members 자신의 정책이 재귀한다.

create function public.current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from members where user_id = auth.uid() and status = 'active'
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members where user_id = auth.uid() and status = 'active' and role = 'admin'
  )
$$;

-- ── RLS ──────────────────────────────────────────────────────

alter table public.members    enable row level security;
alter table public.invites    enable row level security;
alter table public.meetings   enable row level security;
alter table public.attendance enable row level security;

create policy members_read on public.members for select
  using (user_id = auth.uid() or public.is_admin());
create policy members_insert on public.members for insert
  with check (public.is_admin());
create policy members_update on public.members for update
  using (public.is_admin()) with check (public.is_admin());
-- 삭제 정책 없음 — 탈퇴는 status = 'inactive'. 데이터 삭제는 요청이 있을 때 SQL 로 한다.

-- invites: 정책 없음 = 아무도 직접 못 본다.

create policy meetings_read on public.meetings for select
  using (public.current_member_id() is not null);
create policy meetings_write on public.meetings for all
  using (public.is_admin()) with check (public.is_admin());

create policy attendance_read on public.attendance for select
  using (member_id = public.current_member_id() or public.is_admin());
-- 쓰기는 save_attendance 함수로만 — 지우고 넣고 집계 표시를 한 번에 해야 한다.

-- ── 함수 ─────────────────────────────────────────────────────

-- 로그인 이름 → 내부 Auth 이메일(ADR-0011). 가입 전이면 null.
create function public.login_email(p_name text) returns text
language sql stable security definer set search_path = public as $$
  select u.email
  from members m join auth.users u on u.id = m.user_id
  where m.display_name = btrim(p_name)
$$;

-- 초대코드 발급. 그 회원의 안 쓴 옛 코드는 무효로 만든다 — 코드가 둘 돌아다니면 안 된다.
-- 알파벳은 app/src/core/invite.ts 의 CODE_ALPHABET 과 같아야 한다(31자, 0·O·1·I·L 없음).
create function public.issue_invite(p_member uuid)
returns table (code text, expires_on date)
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(8);
  generated text := '';
  expiry timestamptz := now() + interval '7 days';
begin
  if not public.is_admin() then
    raise exception '운영자만 초대코드를 발급할 수 있습니다.' using errcode = '42501';
  end if;
  if not exists (select 1 from members where id = p_member and status <> 'inactive') then
    raise exception '사용 중지된 회원입니다.' using errcode = 'P0001';
  end if;

  for i in 0..7 loop
    -- 256 % 31 = 8 이라 앞쪽 8글자가 아주 조금 더 자주 나온다. 7일짜리 1회용 코드에는 상관없다.
    generated := generated || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;

  update invites set used_at = now() where member_id = p_member and used_at is null;
  insert into invites (code_hash, member_id, expires_at)
  values (encode(digest(generated, 'sha256'), 'hex'), p_member, expiry);

  return query select generated, (expiry at time zone 'Asia/Seoul')::date;
end
$$;

-- 출석 저장. 그 모임의 참석 명단을 통째로 바꾸고 "집계됨"으로 표시한다.
create function public.save_attendance(p_meeting uuid, p_present uuid[]) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception '운영자만 출석을 저장할 수 있습니다.' using errcode = '42501';
  end if;

  delete from attendance where meeting_id = p_meeting;
  insert into attendance (meeting_id, member_id)
  select p_meeting, unnest(p_present)
  on conflict do nothing;
  update meetings set checked_at = now() where id = p_meeting;
end
$$;

revoke execute on function public.issue_invite(uuid) from public, anon;
revoke execute on function public.save_attendance(uuid, uuid[]) from public, anon;
grant execute on function public.issue_invite(uuid) to authenticated;
grant execute on function public.save_attendance(uuid, uuid[]) to authenticated;
grant execute on function public.login_email(text) to anon, authenticated;
