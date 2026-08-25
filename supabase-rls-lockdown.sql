-- ============================================================================
-- 멀티테넌트 Stage 2b — RLS 진짜 격리(테넌트 강제 분리).
-- 반드시 "검증용 Supabase 프로젝트"에서 먼저 실행·검증한 뒤, 동일 파일을 운영에 적용.
-- 선결: 접근 필요한 모든 활성 계정에 accounts.auth_uid 채워져 있어야 함(아래 audit 0건).
--   select id,email from public.accounts where (auth_uid is null or tenant_id is null) and status='활성';
-- tenant#1(기존 SK) 고정 id: 00000000-0000-0000-0000-000000000001
-- ============================================================================

-- ── 0) 테넌트 유도 함수(SECURITY DEFINER 로 accounts 자기참조 RLS 재귀 회피) ──
create or replace function public.auth_tenant_id() returns uuid
  language sql security definer stable set search_path = public as $$
  select tenant_id from public.accounts where auth_uid = auth.uid()::text limit 1
$$;
create or replace function public.is_platform_owner() returns boolean
  language sql security definer stable set search_path = public as $$
  select coalesce((select is_platform_owner from public.accounts
                   where auth_uid = auth.uid()::text limit 1), false)
$$;
revoke all on function public.auth_tenant_id() from public;
revoke all on function public.is_platform_owner() from public;
grant execute on function public.auth_tenant_id() to authenticated, anon;
grant execute on function public.is_platform_owner() to authenticated, anon;

-- ── 1) 일반 테넌트 테이블: 기존 정책 전부 제거 → 테넌트 스코프 4정책 ──
--    (agenda_ballots·issues 포함. 소유자/auth 컬럼은 만들지 않으므로 익명성 유지.)
do $$
declare
  t text;
  p record;
  tbls text[] := array[
    'issues','agendas','agenda_ballots','action_items','profiles','connect_results',
    'team_memories','team_memory_assets','notifications','humor_posts','humor_comments',
    'tea_sessions','can_sessions','can_opinions','app_config','gatherings','gathering_signups',
    'market_items','market_bids','counsel_messages',
    'growth_goals','growth_competencies','growth_competency_log','leader_keys'
  ];
begin
  foreach t in array tbls loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format($f$create policy tenant_sel on public.%I for select
      using (tenant_id = public.auth_tenant_id() or public.is_platform_owner())$f$, t);
    execute format($f$create policy tenant_ins on public.%I for insert
      with check (tenant_id = public.auth_tenant_id() or public.is_platform_owner())$f$, t);
    execute format($f$create policy tenant_upd on public.%I for update
      using (tenant_id = public.auth_tenant_id() or public.is_platform_owner())
      with check (tenant_id = public.auth_tenant_id() or public.is_platform_owner())$f$, t);
    execute format($f$create policy tenant_del on public.%I for delete
      using (tenant_id = public.auth_tenant_id() or public.is_platform_owner())$f$, t);
  end loop;
end $$;

-- ── 2) accounts: 부트스트랩 특례(본인 행 자기읽기로 테넌트 유도 시동) ──
alter table public.accounts enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='accounts' loop
    execute format('drop policy %I on public.accounts', p.policyname);
  end loop;
end $$;
create policy acc_sel on public.accounts for select
  using (auth_uid = auth.uid()::text or tenant_id = public.auth_tenant_id() or public.is_platform_owner());
create policy acc_ins on public.accounts for insert
  with check (auth_uid = auth.uid()::text or public.is_platform_owner());
create policy acc_upd on public.accounts for update
  using (auth_uid = auth.uid()::text or tenant_id = public.auth_tenant_id() or public.is_platform_owner())
  with check (auth_uid = auth.uid()::text or tenant_id = public.auth_tenant_id() or public.is_platform_owner());
create policy acc_del on public.accounts for delete
  using (tenant_id = public.auth_tenant_id() or public.is_platform_owner());
-- 위조 차단: 사용자가 자기 테넌트/오너권한을 못 바꾸게(서버 함수/오너만 변경).
revoke update (tenant_id, is_platform_owner) on public.accounts from authenticated, anon;

-- ── 3) tenants: 가입 코드 조회는 로그인 전(anon)에 일어남 → SELECT 공개, 쓰기는 오너만 ──
alter table public.tenants enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='tenants' loop
    execute format('drop policy %I on public.tenants', p.policyname);
  end loop;
end $$;
create policy tenants_read on public.tenants for select using (true);
create policy tenants_write on public.tenants for all
  using (public.is_platform_owner()) with check (public.is_platform_owner());

-- ── 4) 스토리지 5버킷: 폴더 첫 칸(tenantId)이 내 테넌트와 일치할 때만 ──
--    업로드 경로는 이미 `${tenantId}/...` (tenantContext.tenantPath). 기존 개방 정책 제거 후 재작성.
do $$
declare p record;
  buckets text[] := array['team-memory-assets','gathering-images','market-images','humor-images','profile-characters'];
begin
  -- 이 버킷들을 참조하는 기존 정책 제거(다른 버킷 정책은 건드리지 않음).
  for p in select policyname, qual, with_check from pg_policies
           where schemaname='storage' and tablename='objects' loop
    if (coalesce(p.qual,'') || coalesce(p.with_check,'')) ~ 'team-memory-assets|gathering-images|market-images|humor-images|profile-characters' then
      execute format('drop policy %I on storage.objects', p.policyname);
    end if;
  end loop;
end $$;
do $$
declare b text;
  buckets text[] := array['team-memory-assets','gathering-images','market-images','humor-images','profile-characters'];
begin
  foreach b in array buckets loop
    execute format($f$create policy %I on storage.objects for select
      using (bucket_id=%L and ((storage.foldername(name))[1] = public.auth_tenant_id()::text or public.is_platform_owner()))$f$,
      b||'_sel', b);
    execute format($f$create policy %I on storage.objects for insert
      with check (bucket_id=%L and ((storage.foldername(name))[1] = public.auth_tenant_id()::text or public.is_platform_owner()))$f$,
      b||'_ins', b);
    execute format($f$create policy %I on storage.objects for update
      using (bucket_id=%L and ((storage.foldername(name))[1] = public.auth_tenant_id()::text or public.is_platform_owner()))$f$,
      b||'_upd', b);
    execute format($f$create policy %I on storage.objects for delete
      using (bucket_id=%L and ((storage.foldername(name))[1] = public.auth_tenant_id()::text or public.is_platform_owner()))$f$,
      b||'_del', b);
  end loop;
end $$;

-- ============================================================================
-- 롤백(문제 발생 시) — 아래를 실행하면 즉시 개방 상태로 되돌아간다.
--   do $$
--   declare t text; tbls text[] := array['issues','agendas','agenda_ballots','action_items',
--     'profiles','connect_results','team_memories','team_memory_assets','notifications',
--     'humor_posts','humor_comments','tea_sessions','can_sessions','can_opinions','app_config',
--     'gatherings','gathering_signups','market_items','market_bids','counsel_messages',
--     'growth_goals','growth_competencies','growth_competency_log','leader_keys','accounts','tenants'];
--     p record;
--   begin
--     foreach t in array tbls loop
--       for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
--         execute format('drop policy %I on public.%I', p.policyname, t); end loop;
--       execute format('create policy open_all on public.%I for all using(true) with check(true)', t);
--     end loop;
--   end $$;
--   -- 컬럼 revoke 원복: grant update (tenant_id, is_platform_owner) on public.accounts to authenticated;
-- ============================================================================
