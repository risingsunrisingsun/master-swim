-- 나인틴 v2 — 모임 종류 직접 입력
--
-- 운영자가 '정기 훈련' · '자수모임' 말고도 이름을 직접 붙여 모임을 만든다(kind = 'custom').
-- 'record' 값은 그대로 두고 화면 이름만 '기록회' → '자수모임' 으로 바꿨다 — 값을 바꾸면
-- 이미 만든 모임과 앱의 옛 판이 어긋난다.
--
-- 직접 넣은 이름도 달성률 분모에 똑같이 들어간다. 권한은 0001 의 meetings 정책 그대로다.

alter table public.meetings drop constraint meetings_kind_check;
alter table public.meetings
  add constraint meetings_kind_check check (kind in ('training', 'record', 'custom'));

alter table public.meetings
  add column label text not null default '' check (label = btrim(label) and length(label) <= 20);

-- 직접 입력이면 이름이 있어야 하고, 정해 둔 종류면 이름이 없어야 한다.
alter table public.meetings
  add constraint meetings_label_matches_kind
  check ((kind = 'custom') = (length(label) > 0));
