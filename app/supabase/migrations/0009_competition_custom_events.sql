-- 나인틴 v2 — 대회 종목을 운영자가 적게 한다 (2026-11-20)
--
-- 0008 은 대회 종목을 기록 종목 13개(free-25 … im-100)로만 받았다. 대회 요강에는 200 · 400m,
-- 핀(오리발) 종목이 있으므로 모양만 검사한다:
--   <영법>-<거리>[-fin]   영법 free · back · breast · fly · im, 거리 10~9999(앱은 10~3000m 로 막는다)
-- 예: free-50 · back-200 · free-50-fin. 이미 있는 키(free-50 등)는 그대로 맞는다.
-- 회원 신청(save_entry)은 "대회 종목 안에서"만 검사하므로 고칠 것이 없다.

do $$
declare
  r record;
begin
  -- 0008 의 이름 없는 check(종목 13개 목록)를 찾아 지운다.
  for r in
    select conname from pg_constraint
    where conrelid = 'public.competitions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%free-25%'
  loop
    execute format('alter table public.competitions drop constraint %I', r.conname);
  end loop;
end
$$;

alter table public.competitions
  add constraint competitions_events_shape check (
    array_to_string(events, ',') ~ '^((free|back|breast|fly|im)-[1-9][0-9]{1,3}(-fin)?(,|$))*$'
  );
