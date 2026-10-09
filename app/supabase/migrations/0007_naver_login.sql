-- 나인틴 v2 — 네이버 로그인 (ADR-0012)
--
-- 회원이 네이버 계정으로 들어온다. 네이버는 "카페 회원인가"를 알려주지 않으므로 명단과 잇는다.
--   - 네이버 실명이 명단의 이름과 똑같고, 그 회원이 아직 네이버에 연결되지 않았으면 자동 연결.
--     명단은 운영자가 확인한 사람들이다.
--   - 그 밖에는 가입 신청(join_requests)으로 남고 운영자가 승인한다.
-- 판정과 연결은 Edge Function `naver-login` 이 service_role 로 한다.

alter table public.members
  add column naver_id text unique;

-- 가입 신청. 네이버가 준 값 그대로 둔다 — 운영자가 누구인지 알아보는 데만 쓴다.
create table public.join_requests (
  id         uuid primary key default gen_random_uuid(),
  naver_id   text not null unique,
  name       text not null check (length(name) between 1 and 60),
  nickname   text not null default '' check (length(nickname) <= 60),
  sex        text check (sex in ('M', 'F')),
  birth_year smallint check (birth_year between 1920 and 2020),
  -- pending: 승인 기다림, rejected: 운영자가 거절(다시 로그인해도 신청이 새로 생기지 않는다)
  status     text not null default 'pending' check (status in ('pending', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.join_requests enable row level security;

create policy join_requests_admin on public.join_requests for all
  using (public.is_admin()) with check (public.is_admin());

-- 승인: 신청을 명단의 회원에 잇고 신청을 지운다. 성별 · 출생연도가 비어 있으면 신청 값으로 채운다.
-- 새 사람이면 운영자가 회원을 먼저 만들고 그 id 로 부른다.
create function public.approve_join_request(p_request uuid, p_member uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  req join_requests%rowtype;
begin
  if not public.is_admin() then
    raise exception '운영자만 승인할 수 있습니다.' using errcode = '42501';
  end if;
  select * into req from join_requests where id = p_request;
  if req.id is null then
    raise exception '가입 신청을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from members where id = p_member and status <> 'inactive') then
    raise exception '연결할 회원을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if exists (select 1 from members where id = p_member and naver_id is not null) then
    raise exception '그 회원은 이미 다른 네이버 계정에 연결돼 있습니다.' using errcode = 'P0001';
  end if;

  update members
  set naver_id = req.naver_id,
      sex = coalesce(sex, req.sex),
      birth_year = coalesce(birth_year, req.birth_year)
  where id = p_member;
  delete from join_requests where id = p_request;
end
$$;

grant select, insert, update, delete on public.join_requests to service_role;
grant select, update, delete on public.join_requests to authenticated;

revoke execute on function public.approve_join_request(uuid, uuid) from public, anon;
grant execute on function public.approve_join_request(uuid, uuid) to authenticated;
