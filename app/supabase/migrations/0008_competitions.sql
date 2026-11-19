-- 나인틴 v2 — 대회 참가 신청 취합
--
-- 운영자가 대회를 열고(개인 종목 · 신청 마감일 · 한 사람당 종목 수 · 단체전 의사 받기),
-- 회원이 자기 신청을 남긴다. 운영자는 신청을 모아 엑셀로 받고, "단체전 가능"에서 계영 · 혼계영
-- 명단을 짠다(명단 계산은 화면에서 한다 — 30명이면 브라우저로 충분하다).
--
-- 회원은 대회를 모두 읽고 **자기 신청만** 읽는다. 다른 회원이 무엇을 신청했는지는 보지 않는다
-- (PRD-0001 §2 — 회원끼리 서로의 데이터를 보지 않는다). 운영자는 전부 읽는다.
-- 신청 쓰기는 save_entry · delete_entry 함수로만 — 마감 · 종목 · 개수를 함수가 막는다.

create table public.competitions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 40),
  date       date not null,
  place      text not null default '' check (length(place) <= 40),
  -- 이 날까지(포함, 한국 날짜) 신청 · 수정 · 취소할 수 있다.
  deadline   date not null,
  -- 고를 수 있는 개인 종목. ["free-50", "back-50", "im-100"] — 앱의 종목 키(eventKey)와 같다.
  events     text[] not null default '{}',
  relays     boolean not null default false,
  max_events smallint not null default 2 check (max_events between 1 and 5),
  note       text not null default '' check (length(note) <= 200),
  created_at timestamptz not null default now(),
  check (deadline <= date),
  check (cardinality(events) > 0 or relays),
  check (events <@ array[
    'free-25', 'free-50', 'free-100', 'back-25', 'back-50', 'back-100',
    'breast-25', 'breast-50', 'breast-100', 'fly-25', 'fly-50', 'fly-100', 'im-100'
  ]::text[])
);

create table public.competition_entries (
  competition_id uuid not null references public.competitions (id) on delete cascade,
  member_id      uuid not null references public.members (id) on delete cascade,
  events         text[] not null default '{}',
  relay          boolean not null default false,
  note           text not null default '' check (length(note) <= 100),
  updated_at     timestamptz not null default now(),
  primary key (competition_id, member_id)
);

create index competition_entries_member on public.competition_entries (member_id);

alter table public.competitions enable row level security;
alter table public.competition_entries enable row level security;

-- 대회는 로그인한 사람 누구나 읽고, 운영자만 만들고 고치고 지운다.
create policy competitions_read on public.competitions for select
  using (public.current_member_id() is not null);
create policy competitions_admin on public.competitions for all
  using (public.is_admin()) with check (public.is_admin());

create policy competition_entries_read on public.competition_entries for select
  using (member_id = public.current_member_id() or public.is_admin());

-- 내 신청 저장. 마감 전, 대회 종목 안에서, 개수 안에서, 겹치지 않게.
create function public.save_entry(p_competition uuid, p_events text[], p_relay boolean, p_note text)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.current_member_id();
  c competitions%rowtype;
  v_events text[] := coalesce(p_events, '{}');
begin
  if me is null then
    raise exception '다시 로그인해 주세요.' using errcode = '42501';
  end if;
  select * into c from competitions where id = p_competition;
  if c.id is null then
    raise exception '대회를 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if c.deadline < (now() at time zone 'Asia/Seoul')::date then
    raise exception '신청이 마감됐습니다. 운영진에게 문의하세요.' using errcode = 'P0001';
  end if;
  if cardinality(v_events) = 0 and not coalesce(p_relay, false) then
    raise exception '개인 종목을 하나 이상 고르거나 단체전에 표시해 주세요.' using errcode = 'P0001';
  end if;
  if coalesce(p_relay, false) and not c.relays then
    raise exception '이 대회는 단체전 신청을 받지 않습니다.' using errcode = 'P0001';
  end if;
  if cardinality(v_events) > c.max_events then
    raise exception '개인 종목은 %개까지 고를 수 있습니다.', c.max_events using errcode = 'P0001';
  end if;
  if not (v_events <@ c.events) then
    raise exception '이 대회 종목이 아닌 것을 골랐습니다.' using errcode = 'P0001';
  end if;
  if (select count(distinct e) from unnest(v_events) as e) <> cardinality(v_events) then
    raise exception '같은 종목을 두 번 골랐습니다.' using errcode = 'P0001';
  end if;
  if length(coalesce(p_note, '')) > 100 then
    raise exception '메모는 100자까지입니다.' using errcode = 'P0001';
  end if;

  insert into competition_entries (competition_id, member_id, events, relay, note)
  values (p_competition, me, v_events, coalesce(p_relay, false), btrim(coalesce(p_note, '')))
  on conflict (competition_id, member_id) do update
    set events = excluded.events, relay = excluded.relay, note = excluded.note, updated_at = now();
end
$$;

-- 내 신청 취소. 마감 전에만.
create function public.delete_entry(p_competition uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.current_member_id();
begin
  if me is null then
    raise exception '다시 로그인해 주세요.' using errcode = '42501';
  end if;
  if exists (
    select 1 from competitions
    where id = p_competition and deadline < (now() at time zone 'Asia/Seoul')::date
  ) then
    raise exception '신청이 마감돼 취소할 수 없습니다. 운영진에게 문의하세요.' using errcode = 'P0001';
  end if;
  delete from competition_entries where competition_id = p_competition and member_id = me;
end
$$;

grant select, insert, update, delete on public.competitions, public.competition_entries to service_role;
grant select, insert, update, delete on public.competitions to authenticated;
-- 신청 쓰기는 함수로만. 운영자가 고칠 일은 회원에게 다시 신청해 달라고 하는 편이 맞다.
grant select on public.competition_entries to authenticated;

revoke execute on function public.save_entry(uuid, text[], boolean, text) from public, anon;
revoke execute on function public.delete_entry(uuid) from public, anon;
grant execute on function public.save_entry(uuid, text[], boolean, text) to authenticated;
grant execute on function public.delete_entry(uuid) to authenticated;
