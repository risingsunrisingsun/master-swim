-- 나인틴 v2 — 기록(기능2) · 목표 · 세트 처방 코치 조정(기능1)
--
-- 0001 과 같은 원칙: 회원은 자기 행만, 운영자는 전부. 화면이 숨기는 것은 보안이 아니다.
-- 0002 처럼 테이블 권한(GRANT)도 여기서 함께 연다.

-- ── 기록 ─────────────────────────────────────────────────────

create table public.records (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members (id) on delete cascade,
  stroke     text not null check (stroke in ('free', 'back', 'breast', 'fly', 'im')),
  distance   smallint not null check (distance in (25, 50, 100)),
  -- 1/100초 정수(PRD-0001 §6). 화면이 25m 당 9초~2분으로 한 번 더 거른다.
  time_cs    integer not null check (time_cs between 500 and 60000),
  date       date not null,
  -- self: 회원 본인 입력, meeting: 운영자가 정기모임 기록회에서 넣은 공식 기록
  source     text not null check (source in ('self', 'meeting')),
  meeting_id uuid references public.meetings (id) on delete set null,
  note       text not null default '' check (length(note) <= 100),
  created_at timestamptz not null default now(),
  -- 개인혼영은 100m 만
  check (stroke <> 'im' or distance = 100),
  check (source = 'meeting' or meeting_id is null)
);

create index records_member on public.records (member_id, stroke, distance, date);
create index records_meeting on public.records (meeting_id) where meeting_id is not null;

alter table public.records enable row level security;

create policy records_read on public.records for select
  using (member_id = public.current_member_id() or public.is_admin());
-- 회원은 자기 개인 입력만 넣고 고치고 지운다. 모임 기록은 운영자만(PRD-0001 §4.2).
create policy records_insert on public.records for insert
  with check (
    (member_id = public.current_member_id() and source = 'self') or public.is_admin()
  );
create policy records_update on public.records for update
  using ((member_id = public.current_member_id() and source = 'self') or public.is_admin())
  with check ((member_id = public.current_member_id() and source = 'self') or public.is_admin());
create policy records_delete on public.records for delete
  using ((member_id = public.current_member_id() and source = 'self') or public.is_admin());

-- 모임 기록 저장. 그 모임 · 그 종목의 기록을 통째로 바꾼다 — 출석 저장과 같은 방식.
-- p_entries: [{"member_id": "...", "time_cs": 3240}, ...]
create function public.save_meeting_records(
  p_meeting uuid, p_stroke text, p_distance smallint, p_entries jsonb
) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  meeting_date date;
begin
  if not public.is_admin() then
    raise exception '운영자만 모임 기록을 저장할 수 있습니다.' using errcode = '42501';
  end if;
  select date into meeting_date from meetings where id = p_meeting and not cancelled;
  if meeting_date is null then
    raise exception '모임을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;

  delete from records
  where meeting_id = p_meeting and stroke = p_stroke and distance = p_distance and source = 'meeting';

  insert into records (member_id, stroke, distance, time_cs, date, source, meeting_id)
  select (e ->> 'member_id')::uuid, p_stroke, p_distance, (e ->> 'time_cs')::integer,
         meeting_date, 'meeting', p_meeting
  from jsonb_array_elements(p_entries) as e;
end
$$;

-- ── 목표 ─────────────────────────────────────────────────────
-- 세트 화면에서 정한 종목별 목표기록. 홈의 "목표까지 남은 초" 가 본다.

create table public.goals (
  member_id  uuid not null references public.members (id) on delete cascade,
  stroke     text not null check (stroke in ('free', 'back', 'breast', 'fly')),
  distance   smallint not null check (distance in (50, 100)),
  target_cs  integer not null check (target_cs between 500 and 60000),
  updated_at timestamptz not null default now(),
  primary key (member_id, stroke, distance)
);

alter table public.goals enable row level security;

create policy goals_read on public.goals for select
  using (member_id = public.current_member_id() or public.is_admin());
create policy goals_write on public.goals for all
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id());

-- ── 세트 처방 코치 조정 ─────────────────────────────────────
-- 종목 · 단축 구간(1: 0~1초, 2: 1~2초, 3: 2초 넘게)마다 하나. 없으면 앱이 공식 기본값을 쓴다.
-- plan 의 모양은 app/src/core/sets.ts 의 SetPlan. 앱이 읽을 때 다시 검사한다.

create table public.set_overrides (
  stroke     text not null check (stroke in ('free', 'back', 'breast', 'fly')),
  distance   smallint not null check (distance in (50, 100)),
  bracket    smallint not null check (bracket in (1, 2, 3)),
  plan       jsonb not null,
  updated_by uuid references public.members (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (stroke, distance, bracket)
);

alter table public.set_overrides enable row level security;

create policy set_overrides_read on public.set_overrides for select
  using (public.current_member_id() is not null);
create policy set_overrides_write on public.set_overrides for all
  using (public.is_admin()) with check (public.is_admin());

-- ── 권한 ─────────────────────────────────────────────────────

grant select, insert, update, delete on public.records, public.goals, public.set_overrides
  to service_role;
grant select, insert, update, delete on public.records, public.goals, public.set_overrides
  to authenticated;

revoke execute on function public.save_meeting_records(uuid, text, smallint, jsonb) from public, anon;
grant execute on function public.save_meeting_records(uuid, text, smallint, jsonb) to authenticated;
