-- 멀티테넌트 — 남은 테이블 테넌트화(config PK · growth · leader_keys).
-- 앱 층 읽기/쓰기 스코프가 동작하려면 이 스키마 변경이 선행돼야 한다.
-- Supabase SQL Editor 에 실행. 멱등(IF NOT EXISTS / 백필은 null 대상만).
-- tenant#1(기존 SK 팀) 고정 id: 00000000-0000-0000-0000-000000000001

-- 1) app_config: PK 를 (key) → (tenant_id, key) 로. 팀마다 같은 key 를 따로 갖게.
--    Stage 1 이후 configStore 가 tenant_id 를 안 넣고 저장한 행이 있을 수 있어 먼저 백필.
update public.app_config set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
alter table public.app_config alter column tenant_id set not null;
alter table public.app_config drop constraint if exists app_config_pkey;
alter table public.app_config add primary key (tenant_id, key);

-- 2) growth 3개 테이블: tenant_id 추가 + 백필 + 인덱스.
alter table public.growth_goals           add column if not exists tenant_id uuid;
alter table public.growth_competencies    add column if not exists tenant_id uuid;
alter table public.growth_competency_log  add column if not exists tenant_id uuid;
update public.growth_goals          set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.growth_competencies   set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
update public.growth_competency_log set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
create index if not exists idx_growth_goals_tenant          on public.growth_goals(tenant_id);
create index if not exists idx_growth_competencies_tenant   on public.growth_competencies(tenant_id);
create index if not exists idx_growth_competency_log_tenant on public.growth_competency_log(tenant_id);

-- 3) leader_keys: tenant_id 추가 + 백필 + 인덱스(대나무숲 리더키. account_id 로 이미 사실상
--    테넌트 유니크지만, Stage 2b RLS 를 위해 컬럼을 갖춘다).
alter table public.leader_keys add column if not exists tenant_id uuid;
update public.leader_keys set tenant_id = '00000000-0000-0000-0000-000000000001' where tenant_id is null;
create index if not exists idx_leader_keys_tenant on public.leader_keys(tenant_id);
