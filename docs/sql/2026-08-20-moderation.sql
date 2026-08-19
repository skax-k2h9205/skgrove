-- App Store 심사 지침 1.2(사용자 생성 콘텐츠) — 신고·차단 저장소.
--
-- Apple 요구사항 중 두 가지가 서버 기록을 전제한다:
--   · 신고 메커니즘 — 운영자가 24시간 안에 확인해 조치해야 하므로 남아야 한다.
--   · 차단 메커니즘 — "차단 사실을 개발자에게 알릴 것"이 명시돼 있다.
-- 화면에서 감추는 것만으로는 둘 다 충족되지 않는다.
--
-- 이 프로젝트의 다른 테이블과 같은 전제(RLS 개방 프로토타입)를 따른다.

create table if not exists public.content_reports (
  id            text primary key,
  reporter      text not null default '',
  target_kind   text not null,              -- humorPost | humorComment | market | gathering | issue
  target_id     text not null,
  target_author text not null default '',
  reason        text not null default '',   -- 욕설·비방 / 음란물·선정성 / 스팸·광고 / 개인정보 노출 / 기타
  note          text not null default '',
  -- 운영자 처리 흔적. 24시간 약속을 지켰는지 확인할 수 있어야 한다.
  status        text not null default 'received',   -- received | actioned | dismissed
  handled_at    timestamptz,
  handled_by    text,
  created_at    timestamptz not null default now(),
  tenant_id     uuid
);

-- 같은 사람이 같은 글을 반복 신고해도 한 건으로 본다.
create unique index if not exists content_reports_unique_report
  on public.content_reports (reporter, target_kind, target_id);

-- 운영자 화면은 "아직 처리 안 된 것을 오래된 순으로" 본다.
create index if not exists content_reports_pending
  on public.content_reports (status, created_at);

create table if not exists public.user_blocks (
  id             text primary key,
  blocker        text not null,
  blocked_author text not null,
  created_at     timestamptz not null default now(),
  tenant_id      uuid
);

-- 같은 사람을 두 번 차단해도 한 줄만 남는다.
create unique index if not exists user_blocks_unique_pair
  on public.user_blocks (blocker, blocked_author);

alter table public.content_reports enable row level security;
alter table public.user_blocks     enable row level security;

-- 다른 테이블과 같은 개방 정책(프로토타입). 실제 운영 전환 시 함께 조인다.
drop policy if exists content_reports_all on public.content_reports;
create policy content_reports_all on public.content_reports for all using (true) with check (true);

drop policy if exists user_blocks_all on public.user_blocks;
create policy user_blocks_all on public.user_blocks for all using (true) with check (true);

grant select, insert, update on public.content_reports to anon, authenticated;
grant select, insert, delete on public.user_blocks     to anon, authenticated;
