-- ============================================================================
-- 멀티테넌트 Stage 1 — 기반(비파괴적). tenants 테이블 + 전 테이블 tenant_id + 백필.
-- RLS·스토리지 정책·유니크 제약은 여기서 손대지 않는다(전면개방 유지) → 라이브 무회귀.
-- Supabase SQL Editor 에 통째로 실행. 여러 번 실행해도 안전(IF NOT EXISTS/idempotent).
-- ============================================================================

-- 1) tenants 테이블 --------------------------------------------------------
create table if not exists public.tenants (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  join_code      text not null unique,          -- 가입 시 입력하는 초대코드
  parts          jsonb not null default '[]',    -- 그 팀의 조직 파트 목록(SK teamParts 대체)
  allowed_domain text,                           -- 옵션: 이메일 도메인 제한(null=제한 없음)
  branding       jsonb not null default '{}',    -- 표시 이름/로고 등
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
-- 프로토타입 RLS(전면개방) — Stage 2 에서 격리로 교체.
alter table public.tenants enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='tenants' and policyname='tenants open all') then
    create policy "tenants open all" on public.tenants for all using (true) with check (true);
  end if;
end $$;

-- 2) tenant#1 = 기존 팀(SK AI ITS 혁신팀) 시드 ---------------------------------
--    id 를 고정 uuid 로 박아 백필에서 참조한다. join_code 는 운영 시 바꿔도 됨.
insert into public.tenants (id, name, join_code, parts)
values (
  '00000000-0000-0000-0000-000000000001',
  'SK AI ITS 혁신팀',
  'SK-AITS',
  '["TEST혁신파트","ITS혁신파트","PM혁신파트"]'::jsonb
)
on conflict (id) do nothing;

-- 3) accounts 정식화: tenant_id + is_platform_owner + 스키마 드리프트(auth_uid/slack_user_id)
alter table public.accounts add column if not exists tenant_id uuid;
alter table public.accounts add column if not exists is_platform_owner boolean not null default false;
alter table public.accounts add column if not exists auth_uid text;        -- 앱이 이미 씀(committed SQL 누락분)
alter table public.accounts add column if not exists slack_user_id text;   -- 앱이 이미 씀

-- 4) 전 21개 앱 테이블에 tenant_id 추가 -------------------------------------
alter table public.issues              add column if not exists tenant_id uuid;
alter table public.agendas             add column if not exists tenant_id uuid;
alter table public.agenda_ballots      add column if not exists tenant_id uuid;
alter table public.action_items        add column if not exists tenant_id uuid;
alter table public.profiles            add column if not exists tenant_id uuid;
alter table public.connect_results     add column if not exists tenant_id uuid;
alter table public.team_memories       add column if not exists tenant_id uuid;
alter table public.team_memory_assets  add column if not exists tenant_id uuid;
alter table public.notifications       add column if not exists tenant_id uuid;
alter table public.humor_posts         add column if not exists tenant_id uuid;
alter table public.humor_comments      add column if not exists tenant_id uuid;
alter table public.tea_sessions        add column if not exists tenant_id uuid;
alter table public.can_sessions        add column if not exists tenant_id uuid;
alter table public.can_opinions        add column if not exists tenant_id uuid;
alter table public.app_config          add column if not exists tenant_id uuid;
alter table public.gatherings          add column if not exists tenant_id uuid;
alter table public.gathering_signups   add column if not exists tenant_id uuid;
alter table public.market_items        add column if not exists tenant_id uuid;
alter table public.market_bids         add column if not exists tenant_id uuid;
alter table public.counsel_messages    add column if not exists tenant_id uuid;

-- 5) 기존 전 행을 tenant#1 로 백필 ------------------------------------------
update public.accounts             set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.issues               set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.agendas              set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.agenda_ballots       set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.action_items         set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.profiles             set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.connect_results      set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.team_memories        set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.team_memory_assets   set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.notifications        set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.humor_posts          set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.humor_comments       set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.tea_sessions         set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.can_sessions         set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.can_opinions         set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.app_config           set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.gatherings           set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.gathering_signups    set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.market_items         set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.market_bids          set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.counsel_messages     set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;

-- 6) tenant_id 인덱스(테넌트별 조회 성능) -----------------------------------
create index if not exists idx_accounts_tenant            on public.accounts(tenant_id);
create index if not exists idx_issues_tenant              on public.issues(tenant_id);
create index if not exists idx_agendas_tenant             on public.agendas(tenant_id);
create index if not exists idx_agenda_ballots_tenant      on public.agenda_ballots(tenant_id);
create index if not exists idx_action_items_tenant        on public.action_items(tenant_id);
create index if not exists idx_profiles_tenant            on public.profiles(tenant_id);
create index if not exists idx_connect_results_tenant     on public.connect_results(tenant_id);
create index if not exists idx_team_memories_tenant       on public.team_memories(tenant_id);
create index if not exists idx_team_memory_assets_tenant  on public.team_memory_assets(tenant_id);
create index if not exists idx_notifications_tenant       on public.notifications(tenant_id);
create index if not exists idx_humor_posts_tenant         on public.humor_posts(tenant_id);
create index if not exists idx_humor_comments_tenant      on public.humor_comments(tenant_id);
create index if not exists idx_tea_sessions_tenant        on public.tea_sessions(tenant_id);
create index if not exists idx_can_sessions_tenant        on public.can_sessions(tenant_id);
create index if not exists idx_can_opinions_tenant        on public.can_opinions(tenant_id);
create index if not exists idx_app_config_tenant          on public.app_config(tenant_id);
create index if not exists idx_gatherings_tenant          on public.gatherings(tenant_id);
create index if not exists idx_gathering_signups_tenant   on public.gathering_signups(tenant_id);
create index if not exists idx_market_items_tenant        on public.market_items(tenant_id);
create index if not exists idx_market_bids_tenant         on public.market_bids(tenant_id);
create index if not exists idx_counsel_messages_tenant    on public.counsel_messages(tenant_id);

-- 7) 플랫폼 오너 지정(수정해서 실행) ----------------------------------------
--    당신 계정을 최상위 플랫폼 오너로. 이메일을 본인 것으로 바꾼 뒤 실행.
-- update public.accounts set is_platform_owner = true where lower(email) = 'k2h9205@sk.com';

-- ============================================================================
-- 다음(Stage 2, 별도 파일): RLS 테넌트 격리 · 스토리지 tenant 경로 정책 ·
--   유니크/PK 를 (tenant_id, email) / (tenant_id, key) 로 전환. 2번째 테넌트 실입주 직전.
-- ============================================================================
