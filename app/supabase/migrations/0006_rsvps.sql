-- 나인틴 v2 — 모임 참석 여부(회원이 미리 답한다)
--
-- **출석과 다르다.** 출석(attendance)은 운영자가 모임 뒤에 체크하는 실제 참석이고 달성률을
-- 정한다(PRD-0001 §4.3 "회원 자가 체크는 없다"는 그대로). 여기는 모임 전에 회원이 "갈게요 /
-- 못 가요"를 미리 알리는 것이다. 운영자는 인원을 가늠하고, 출석 체크를 이 답에서 시작할 수 있다.
--
-- 회원은 자기 답만 읽고, 운영자는 전부 읽는다. 쓰기는 set_rsvp 함수로만 —
-- 지난 모임 · 취소된 모임에 답하지 못하게 함수가 막는다.

create table public.rsvps (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  going      boolean not null,
  updated_at timestamptz not null default now(),
  primary key (meeting_id, member_id)
);

create index rsvps_member on public.rsvps (member_id);

alter table public.rsvps enable row level security;

create policy rsvps_read on public.rsvps for select
  using (member_id = public.current_member_id() or public.is_admin());

-- 내 답 정하기. p_going 이 null 이면 답을 지운다(아직 모름으로 되돌리기).
-- 날짜는 한국 날짜로 본다 — 서버 시계는 UTC 라 오전 9시 전에는 하루가 밀린다.
create function public.set_rsvp(p_meeting uuid, p_going boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.current_member_id();
begin
  if me is null then
    raise exception '다시 로그인해 주세요.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from meetings
    where id = p_meeting and not cancelled and date >= (now() at time zone 'Asia/Seoul')::date
  ) then
    raise exception '지난 모임이나 취소된 모임에는 답할 수 없습니다.' using errcode = 'P0001';
  end if;

  if p_going is null then
    delete from rsvps where meeting_id = p_meeting and member_id = me;
  else
    insert into rsvps (meeting_id, member_id, going) values (p_meeting, me, p_going)
    on conflict (meeting_id, member_id) do update set going = excluded.going, updated_at = now();
  end if;
end
$$;

grant select, insert, update, delete on public.rsvps to service_role;
grant select on public.rsvps to authenticated;

revoke execute on function public.set_rsvp(uuid, boolean) from public, anon;
grant execute on function public.set_rsvp(uuid, boolean) to authenticated;
