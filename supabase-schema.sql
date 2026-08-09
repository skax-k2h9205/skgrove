create table if not exists public.accounts (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('팀원', '파트리더', '팀리더')),
  part text not null check (part in ('전체', 'TEST혁신파트', 'ITS혁신파트', 'PM혁신파트', '혁신도구파트')),
  status text not null check (status in ('승인 대기', '활성', '비활성')),
  joined_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 계정별 프로필 사진(직접 이미지 URL). 없으면 앱에서 이니셜 칩으로 폴백.
alter table public.accounts add column if not exists photo_url text;

-- 커넥셔너(시스템 구축 슈퍼관리자) 여부 — 팀 역할과 별개인 전권 플래그. 계정 관리에서 토글.
alter table public.accounts add column if not exists is_connectioner boolean not null default false;

-- 슬랙 DM 발송용 이메일. 앱 로그인 이메일과 슬랙 계정 이메일이 다를 수 있어 별도 관리(없으면 email로 폴백).
alter table public.accounts add column if not exists slack_email text;

-- 로그인 비밀번호 해시(pbkdf2$...). 없으면 첫 로그인 때 본인이 설정. 평문은 저장하지 않는다.
alter table public.accounts add column if not exists password_hash text;

alter table public.accounts enable row level security;

drop policy if exists "Allow prototype account reads" on public.accounts;
drop policy if exists "Allow prototype account writes" on public.accounts;
drop policy if exists "Allow prototype account updates" on public.accounts;

create policy "Allow prototype account reads"
  on public.accounts
  for select
  using (true);

create policy "Allow prototype account writes"
  on public.accounts
  for insert
  with check (true);

create policy "Allow prototype account updates"
  on public.accounts
  for update
  using (true)
  with check (true);

insert into public.accounts (id, name, email, role, part, status, joined_at)
values
  ('USR-ADMIN', '이선민', 'sunmin.l@sk.com', '팀리더', '전체', '활성', '2026-07-24'),
  ('USR-02', '김승현', 'k2h9205@sk.com', '파트리더', 'ITS혁신파트', '활성', '2026-07-24'),
  ('USR-03', '김수정', 'crystalk@sk.com', '팀원', '혁신도구파트', '승인 대기', '2026-07-24')
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  part = excluded.part,
  status = excluded.status,
  joined_at = excluded.joined_at,
  updated_at = now();

create table if not exists public.issues (
  id text primary key,
  title text not null,
  category text not null,
  author text not null check (author in ('익명', '실명')),
  anonymous_access_code text,
  submitter_name text,
  submitter_email text,
  submitter_part text,
  target text not null,
  status text not null,
  urgency text not null check (urgency in ('낮음', '보통', '높음')),
  leader_reply text,
  one_on_one_note text,
  action_item text,
  leader_memo text,
  submitter_response text,
  one_on_one_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.issues
  add column if not exists anonymous_access_code text,
  add column if not exists submitter_name text,
  add column if not exists submitter_email text,
  add column if not exists submitter_part text,
  add column if not exists leader_reply text,
  add column if not exists one_on_one_note text,
  add column if not exists action_item text,
  add column if not exists leader_memo text,
  -- 접수 화면에서 받던 본문·기대 변화·공개 범위. 예전에는 저장되지 않고 폐기됐다.
  add column if not exists body text not null default '',
  add column if not exists expected_change text not null default '',
  -- 공개 범위를 모르는 과거 행은 공개하지 않는 쪽으로 채운다.
  add column if not exists visibility text not null default '리더만 보기',
  add column if not exists submitter_response text,
  add column if not exists one_on_one_response text,
  -- 보류·종료로 바꿀 때 리더가 남긴 사유. 접수자에게도 그대로 보인다.
  -- 이유 없이 상태만 바뀌면 접수자는 무시당했다고 읽는다.
  add column if not exists status_reason text;

alter table public.issues enable row level security;

drop policy if exists "Allow prototype issue reads" on public.issues;
drop policy if exists "Allow prototype issue writes" on public.issues;
drop policy if exists "Allow prototype issue updates" on public.issues;

create policy "Allow prototype issue reads"
  on public.issues
  for select
  using (true);

create policy "Allow prototype issue writes"
  on public.issues
  for insert
  with check (true);

create policy "Allow prototype issue updates"
  on public.issues
  for update
  using (true)
  with check (true);

create table if not exists public.agendas (
  id text primary key,
  title text not null,
  description text not null default '',
  category text not null,
  source text not null,
  part text not null check (part in ('전체', 'TEST혁신파트', 'ITS혁신파트', 'PM혁신파트', '혁신도구파트')),
  author text not null check (author in ('익명', '실명')),
  author_name text not null default '',
  approve integer not null default 0,
  reject integer not null default 0,
  -- '결정됨'은 객관식 전용. 찬반의 통과/부결과 달리 "어느 선택지로 정해졌는가"를 뜻한다.
  status text not null check (status in ('투표중', '통과', '부결', '결정됨')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agendas enable row level security;

drop policy if exists "Allow prototype agenda reads" on public.agendas;
drop policy if exists "Allow prototype agenda writes" on public.agendas;
drop policy if exists "Allow prototype agenda updates" on public.agendas;

create policy "Allow prototype agenda reads"
  on public.agendas
  for select
  using (true);

create policy "Allow prototype agenda writes"
  on public.agendas
  for insert
  with check (true);

create policy "Allow prototype agenda updates"
  on public.agendas
  for update
  using (true)
  with check (true);

alter table public.agendas
  add column if not exists deadline date,
  add column if not exists closed_at date,
  -- 등록 시점의 투표 대상 인원. 계정 변동에 과거 안건의 정족수/참여율이 흔들리지 않도록 스냅샷으로 둔다.
  add column if not exists eligible_count integer not null default 0,
  -- 객관식 투표. 전부 기본값이 있어 이미 쌓인 안건은 그대로 찬반으로 읽힌다.
  add column if not exists vote_type text not null default '찬반',
  -- [{ id, label, count }]. 찬반이면 빈 배열이다.
  add column if not exists options jsonb not null default '[]'::jsonb,
  add column if not exists multi_select boolean not null default false,
  -- 실제로 투표한 '사람' 수. 복수 선택이면 options의 count 합이 인원을 넘으므로 따로 센다.
  add column if not exists voter_count integer not null default 0;

-- 이미 만들어진 테이블에는 위 create table의 check가 적용되지 않는다. 제약을 다시 건다.
alter table public.agendas drop constraint if exists agendas_status_check;
alter table public.agendas
  add constraint agendas_status_check check (status in ('투표중', '통과', '부결', '결정됨'));

alter table public.agendas drop constraint if exists agendas_vote_type_check;
alter table public.agendas
  add constraint agendas_vote_type_check check (vote_type in ('찬반', '객관식'));

-- 투표용지. 익명성을 위해 "누가 투표했는가"만 담고 선택(찬성/반대 · 객관식 선택지)은 담지 않는다.
-- 선택은 agendas.approve / agendas.reject 카운터와 agendas.options[].count 집계에만 반영되므로
-- 이 테이블의 어떤 행도 사람과 선택을 이어주지 못한다.
create table if not exists public.agenda_ballots (
  agenda_id text not null references public.agendas(id) on delete cascade,
  -- sha256(agenda_id + 소문자 이메일). 안건마다 값이 달라 투표 이력이 연결되지 않는다.
  voter_key text not null,
  created_at timestamptz not null default now(),
  primary key (agenda_id, voter_key)
);

alter table public.agenda_ballots enable row level security;

drop policy if exists "Allow prototype ballot reads" on public.agenda_ballots;
drop policy if exists "Allow prototype ballot writes" on public.agenda_ballots;

create policy "Allow prototype ballot reads"
  on public.agenda_ballots
  for select
  using (true);

create policy "Allow prototype ballot writes"
  on public.agenda_ballots
  for insert
  with check (true);

create table if not exists public.action_items (
  id text primary key,
  title text not null,
  owner text not null default '미정',
  -- 목표일 미정을 허용한다. 담당자 없이 먼저 만들어두는 흐름이 실제로 있다.
  due date,
  status text not null check (status in ('대기', '진행중', '완료', '재검토')),
  source_kind text not null check (source_kind in ('안건', '캔미팅', '직접')),
  source_id text,
  source_label text,
  -- 적용 결과와 재검토 사유. 완료/재검토로 넘길 때 무엇이 왜 그랬는지 남긴다.
  outcome text,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.action_items enable row level security;

drop policy if exists "Allow prototype action reads" on public.action_items;
drop policy if exists "Allow prototype action writes" on public.action_items;
drop policy if exists "Allow prototype action updates" on public.action_items;

create policy "Allow prototype action reads"
  on public.action_items
  for select
  using (true);

create policy "Allow prototype action writes"
  on public.action_items
  for insert
  with check (true);

create policy "Allow prototype action updates"
  on public.action_items
  for update
  using (true)
  with check (true);

create table if not exists public.profiles (
  profile_key text primary key,
  owner_email text,
  name text not null,
  part text not null check (part in ('전체', 'TEST혁신파트', 'ITS혁신파트', 'PM혁신파트', '혁신도구파트')),
  role text not null default '',
  english_name text not null default '',
  birth_year text not null default '',
  birthday text not null default '',
  character text not null default '',
  trait text not null default '',
  style text not null default '',
  collaboration text not null default '',
  feedback text not null default '',
  guide text not null default '',
  color text not null check (color in ('green', 'red', 'blue', 'yellow')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Allow prototype profile reads" on public.profiles;
drop policy if exists "Allow prototype profile writes" on public.profiles;
drop policy if exists "Allow prototype profile updates" on public.profiles;

create policy "Allow prototype profile reads"
  on public.profiles
  for select
  using (true);

create policy "Allow prototype profile writes"
  on public.profiles
  for insert
  with check (true);

create policy "Allow prototype profile updates"
  on public.profiles
  for update
  using (true)
  with check (true);

create table if not exists public.connect_results (
  id text primary key,
  mode text not null check (mode in ('coffee', 'teams')),
  title text not null,
  summary text not null default '',
  share_text text not null default '',
  share_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.connect_results enable row level security;

drop policy if exists "Allow prototype connect result reads" on public.connect_results;
drop policy if exists "Allow prototype connect result writes" on public.connect_results;
drop policy if exists "Allow prototype connect result updates" on public.connect_results;
drop policy if exists "Allow prototype connect result deletes" on public.connect_results;

create policy "Allow prototype connect result reads"
  on public.connect_results
  for select
  using (true);

create policy "Allow prototype connect result writes"
  on public.connect_results
  for insert
  with check (true);

create policy "Allow prototype connect result updates"
  on public.connect_results
  for update
  using (true)
  with check (true);

create policy "Allow prototype connect result deletes"
  on public.connect_results
  for delete
  using (true);

create table if not exists public.team_memories (
  id bigint primary key,
  title text not null,
  event_date date not null,
  place text not null default '장소 미정',
  host text not null,
  created_by text not null,
  summary text not null default '',
  tags jsonb not null default '[]'::jsonb,
  drive_folder_id text,
  drive_folder_url text,
  comments jsonb not null default '[]'::jsonb,
  reactions jsonb not null default '{"좋아요":0,"웃겨요":0,"또가요":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.team_memories
  add column if not exists drive_folder_id text,
  add column if not exists drive_folder_url text;

alter table public.team_memories enable row level security;

drop policy if exists "Allow prototype team memory reads" on public.team_memories;
drop policy if exists "Allow prototype team memory writes" on public.team_memories;
drop policy if exists "Allow prototype team memory updates" on public.team_memories;
drop policy if exists "Allow prototype team memory deletes" on public.team_memories;

create policy "Allow prototype team memory reads"
  on public.team_memories
  for select
  using (true);

create policy "Allow prototype team memory writes"
  on public.team_memories
  for insert
  with check (true);

create policy "Allow prototype team memory updates"
  on public.team_memories
  for update
  using (true)
  with check (true);

create policy "Allow prototype team memory deletes"
  on public.team_memories
  for delete
  using (true);

create table if not exists public.team_memory_assets (
  id bigint primary key,
  memory_id bigint not null references public.team_memories(id) on delete cascade,
  type text not null check (type in ('photo', 'video')),
  title text not null,
  uploader text not null,
  tone text not null check (tone in ('green', 'blue', 'coral', 'amber')),
  uploaded_at text not null,
  reactions jsonb not null default '{"👍":0,"👏":0,"😂":0,"🔥":0,"💚":0}'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  preview_url text,
  storage_path text,
  drive_file_id text,
  drive_view_url text,
  drive_download_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.team_memory_assets
  add column if not exists drive_file_id text,
  add column if not exists drive_view_url text,
  add column if not exists drive_download_url text;

alter table public.team_memory_assets enable row level security;

drop policy if exists "Allow prototype team memory asset reads" on public.team_memory_assets;
drop policy if exists "Allow prototype team memory asset writes" on public.team_memory_assets;
drop policy if exists "Allow prototype team memory asset updates" on public.team_memory_assets;
drop policy if exists "Allow prototype team memory asset deletes" on public.team_memory_assets;

create policy "Allow prototype team memory asset reads"
  on public.team_memory_assets
  for select
  using (true);

create policy "Allow prototype team memory asset writes"
  on public.team_memory_assets
  for insert
  with check (true);

create policy "Allow prototype team memory asset updates"
  on public.team_memory_assets
  for update
  using (true)
  with check (true);

create policy "Allow prototype team memory asset deletes"
  on public.team_memory_assets
  for delete
  using (true);

insert into storage.buckets (id, name, public)
values ('team-memory-assets', 'team-memory-assets', true)
on conflict (id) do update set
  public = excluded.public;

drop policy if exists "Allow prototype team memory file reads" on storage.objects;
drop policy if exists "Allow prototype team memory file writes" on storage.objects;
drop policy if exists "Allow prototype team memory file updates" on storage.objects;
drop policy if exists "Allow prototype team memory file deletes" on storage.objects;

create policy "Allow prototype team memory file reads"
  on storage.objects
  for select
  using (bucket_id = 'team-memory-assets');

create policy "Allow prototype team memory file writes"
  on storage.objects
  for insert
  with check (bucket_id = 'team-memory-assets');

create policy "Allow prototype team memory file updates"
  on storage.objects
  for update
  using (bucket_id = 'team-memory-assets')
  with check (bucket_id = 'team-memory-assets');

create policy "Allow prototype team memory file deletes"
  on storage.objects
  for delete
  using (bucket_id = 'team-memory-assets');

-- =====================================================================
-- 김승현 기능 테이블 (SKSOOP-14/15/21/130) — 프로토타입 개방 정책(for all).
-- 실서비스 전 RLS를 인증 기반으로 강화 필요.
-- =====================================================================

-- 알림 / 메시지 (SKSOOP-21)
create table if not exists public.notifications (
  id text primary key,
  kind text not null,
  recipient_name text not null,
  from_name text not null default '',
  title text not null default '',
  body text not null default '',
  section text not null,
  source_id text not null default '',
  dedupe_key text not null default '',
  created_at text not null default '',
  read boolean not null default false
);
alter table public.notifications enable row level security;
drop policy if exists "Allow prototype notifications all" on public.notifications;
create policy "Allow prototype notifications all" on public.notifications for all using (true) with check (true);

-- 유머게시판 (SKSOOP-130)
create table if not exists public.humor_posts (
  id text primary key,
  author text not null,
  body text not null default '',
  media_url text not null default '',
  image_url text,
  created_at text not null default '',
  liked_by jsonb not null default '[]'::jsonb
);
alter table public.humor_posts enable row level security;
drop policy if exists "Allow prototype humor posts all" on public.humor_posts;
create policy "Allow prototype humor posts all" on public.humor_posts for all using (true) with check (true);
-- 이미 만들어진 DB에도 컬럼을 더한다(create table if not exists 는 기존 테이블을 안 건드린다).
alter table public.humor_posts add column if not exists image_url text;

create table if not exists public.humor_comments (
  id text primary key,
  post_id text not null,
  author text not null,
  body text not null default '',
  created_at text not null default ''
);
alter table public.humor_comments enable row level security;
drop policy if exists "Allow prototype humor comments all" on public.humor_comments;
create policy "Allow prototype humor comments all" on public.humor_comments for all using (true) with check (true);

-- 티미팅 세션 (SKSOOP-15) — 세션 유형/캔 단계 같은 config 는 로컬 유지
create table if not exists public.tea_sessions (
  id text primary key,
  title text not null default '',
  type text not null default '',
  presenter text not null default '',
  part text not null,
  description text not null default '',
  status text not null default '제안',
  memo text not null default '',
  held_at text not null default ''
);
-- 이미 만들어진 테이블에도 컬럼을 붙인다. 제안 단계 세션은 빈 값으로 남는다.
alter table public.tea_sessions add column if not exists held_at text not null default '';
alter table public.tea_sessions enable row level security;
drop policy if exists "Allow prototype tea sessions all" on public.tea_sessions;
create policy "Allow prototype tea sessions all" on public.tea_sessions for all using (true) with check (true);

-- 캔미팅 (SKSOOP-14) — 스키마 선반영. 스토어/App 연동은 후속(현재 메모리 상태).
create table if not exists public.can_sessions (
  id text primary key,
  topic text not null default '',
  team_name text not null default '',
  held_at text not null default '',
  method text not null default '오프라인',
  parts jsonb not null default '[]'::jsonb,
  stage text not null default 'setup',
  result_summary text not null default '',
  result_groups jsonb,
  follow_up jsonb
);
alter table public.can_sessions enable row level security;
drop policy if exists "Allow prototype can sessions all" on public.can_sessions;
create policy "Allow prototype can sessions all" on public.can_sessions for all using (true) with check (true);

create table if not exists public.can_opinions (
  id text primary key,
  session_id text not null,
  part text not null,
  step text not null,
  content text not null default '',
  author text not null,
  author_name text not null default '',
  selected boolean not null default false
);
alter table public.can_opinions enable row level security;
drop policy if exists "Allow prototype can opinions all" on public.can_opinions;
create policy "Allow prototype can opinions all" on public.can_opinions for all using (true) with check (true);

-- 팀 공용 설정(캔미팅 단계, 티미팅 세션 유형 등) — key/value.
-- 이 설정들은 "모든 캔미팅에 공통 적용"되는 팀 약속이라 기기별 localStorage가 아니라 DB에 둔다.
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
drop policy if exists "Allow prototype app config all" on public.app_config;
create policy "Allow prototype app config all" on public.app_config for all using (true) with check (true);

-- 번개 모임 / 일정공모 — 메뉴는 둘이지만 kind 하나로 가르는 한 테이블.
-- 상태(모집중/마감/진행함)는 저장하지 않는다. 정원·시각으로 앱이 파생한다.
-- 저장하면 아무도 접속하지 않는 사이 '모집중'으로 남는 어긋남이 생긴다.
create table if not exists public.gatherings (
  id text primary key,
  kind text not null default 'flash',
  title text not null default '',
  start_at text not null default '',
  place text not null default '',
  capacity integer,               -- null = 인원 제한 없음
  close_at text not null default '',
  min_people integer,             -- null = 최소 인원 없음
  description text not null default '',
  part text not null default '전체',
  cost text not null default '없음',
  image_url text,                 -- 첨부 사진. 없으면 poster 를 쓴다
  poster jsonb,                   -- LLM/로컬이 만든 문구·색·아이콘
  host text not null default '',
  created_at text not null default '',
  canceled boolean not null default false
);
-- 번개 커피뽑기: 모임당 커피 담당 한 명(1:1)이라 컬럼으로 둔다. 기존 행은 null = 아직 안 뽑음.
alter table public.gatherings add column if not exists coffee_draw boolean;
alter table public.gatherings add column if not exists coffee_pick text;
alter table public.gatherings add column if not exists coffee_pool jsonb;
alter table public.gatherings add column if not exists coffee_picked_at timestamptz;

alter table public.gatherings enable row level security;
drop policy if exists "Allow prototype gatherings all" on public.gatherings;
create policy "Allow prototype gatherings all" on public.gatherings for all using (true) with check (true);

-- 신청은 별도 행이다. 모임 안에 배열로 넣으면 두 사람이 같은 순간에 신청할 때
-- 나중 쓰기가 앞 쓰기를 지워 한 명이 조용히 사라진다(선착순에서 가장 치명적).
-- created_at 이 선착순 순서의 유일한 근거이므로 반드시 값이 있어야 한다.
create table if not exists public.gathering_signups (
  id text primary key,
  gathering_id text not null references public.gatherings(id) on delete cascade,
  name text not null,
  created_at text not null,
  -- 한 사람이 같은 모임에 두 번 줄 서지 못하게 DB 에서도 막는다.
  unique (gathering_id, name)
);
create index if not exists gathering_signups_gathering_idx on public.gathering_signups (gathering_id, created_at);
alter table public.gathering_signups enable row level security;
drop policy if exists "Allow prototype gathering signups all" on public.gathering_signups;
create policy "Allow prototype gathering signups all" on public.gathering_signups for all using (true) with check (true);

-- 모임 대표 이미지 버킷. 첨부 사진과 AI 가 그린 썸네일이 같은 경로를 탄다
-- (gatheringStore.uploadGatheringImage). 버킷이 없으면 업로드가 실패하고 프론트가
-- URL.createObjectURL 로 폴백하는데, blob: 은 그 페이지 수명까지만 살아서
-- 새로고침하면 이미지가 사라진다. team-memory-assets 와 같은 개방 정책이다.
insert into storage.buckets (id, name, public)
values ('gathering-images', 'gathering-images', true)
on conflict (id) do update set
  public = excluded.public;

drop policy if exists "Allow prototype gathering image reads" on storage.objects;
drop policy if exists "Allow prototype gathering image writes" on storage.objects;
drop policy if exists "Allow prototype gathering image updates" on storage.objects;
drop policy if exists "Allow prototype gathering image deletes" on storage.objects;

create policy "Allow prototype gathering image reads"
  on storage.objects
  for select
  using (bucket_id = 'gathering-images');

create policy "Allow prototype gathering image writes"
  on storage.objects
  for insert
  with check (bucket_id = 'gathering-images');

create policy "Allow prototype gathering image updates"
  on storage.objects
  for update
  using (bucket_id = 'gathering-images')
  with check (bucket_id = 'gathering-images');

create policy "Allow prototype gathering image deletes"
  on storage.objects
  for delete
  using (bucket_id = 'gathering-images');

-- ===== 벼룩숲 (팀 내 중고거래) =====
-- 모임·번개와 같은 구조다. 물건 하나 + 입찰 별도 행.
-- 상태(거래중/거래완료/유찰)는 저장하지 않고 close_at 과 입찰에서 파생시킨다 —
-- 저장하면 마감 시각이 지났는데 거래중으로 남는 어긋남이 반드시 생긴다.
create table if not exists public.market_items (
  id text primary key,
  kind text not null default 'auction',   -- auction(경매) | giveaway(나눔)
  title text not null default '',
  description text not null default '',
  start_price integer not null default 0, -- 나눔이면 0
  min_step integer not null default 0,    -- 최소 인상폭. 없으면 1원씩 올리는 눈치싸움이 된다
  close_at text not null default '',
  extended_to text,                       -- 막판 입찰로 밀린 마감. 원래 약속은 close_at 에 남긴다
  place text not null default '',
  image_url text,                         -- 첨부 사진. 없으면 poster 를 쓴다
  poster jsonb,                           -- 사진이 없을 때 만드는 문구·색·아이콘
  seller text not null default '',
  created_at text not null default '',
  canceled boolean not null default false,
  -- 거래 완료는 양쪽이 각각 누른다. 앱이 결제를 다루지 않아 누가 잘못했는지
  -- 판정할 수 없으므로 한쪽 말만으로 완료로 바꾸지 않는다.
  seller_done boolean not null default false,
  buyer_done boolean not null default false
);
alter table public.market_items enable row level security;
drop policy if exists "Allow prototype market items all" on public.market_items;
create policy "Allow prototype market items all" on public.market_items for all using (true) with check (true);

-- 입찰은 별도 행이다. 물건 안에 배열로 넣으면 두 사람이 같은 순간에 부를 때
-- 나중 쓰기가 앞 쓰기를 지워 한 건이 조용히 사라진다.
-- created_at 은 동액일 때의 승자와 나눔 선착순을 가르는 유일한 근거라 반드시 값이 있어야 한다.
create table if not exists public.market_bids (
  id text primary key,
  item_id text not null,
  name text not null,
  amount integer not null default 0,      -- 나눔이면 0
  created_at text not null default ''
);
alter table public.market_bids enable row level security;
drop policy if exists "Allow prototype market bids all" on public.market_bids;
create policy "Allow prototype market bids all" on public.market_bids for all using (true) with check (true);

-- 물건 사진 버킷. 없으면 첨부가 저장되지 않고 새로고침 때 사진이 사라진다
-- (업로드 실패 시 화면에는 임시 objectURL 로만 남기 때문이다).
insert into storage.buckets (id, name, public)
values ('market-images', 'market-images', true)
on conflict (id) do update set
  public = excluded.public;

drop policy if exists "Allow prototype market image reads" on storage.objects;
drop policy if exists "Allow prototype market image writes" on storage.objects;
drop policy if exists "Allow prototype market image updates" on storage.objects;
drop policy if exists "Allow prototype market image deletes" on storage.objects;

create policy "Allow prototype market image reads"
  on storage.objects
  for select
  using (bucket_id = 'market-images');

create policy "Allow prototype market image writes"
  on storage.objects
  for insert
  with check (bucket_id = 'market-images');

create policy "Allow prototype market image updates"
  on storage.objects
  for update
  using (bucket_id = 'market-images')
  with check (bucket_id = 'market-images');

create policy "Allow prototype market image deletes"
  on storage.objects
  for delete
  using (bucket_id = 'market-images');

-- 유머게시판 생성 썸네일 버킷. gathering-images/market-images 와 같은 개방 정책이다.
insert into storage.buckets (id, name, public)
values ('humor-images', 'humor-images', true)
on conflict (id) do update set
  public = excluded.public;

drop policy if exists "Allow prototype humor image reads" on storage.objects;
drop policy if exists "Allow prototype humor image writes" on storage.objects;
drop policy if exists "Allow prototype humor image updates" on storage.objects;
drop policy if exists "Allow prototype humor image deletes" on storage.objects;

create policy "Allow prototype humor image reads"
  on storage.objects
  for select
  using (bucket_id = 'humor-images');

create policy "Allow prototype humor image writes"
  on storage.objects
  for insert
  with check (bucket_id = 'humor-images');

create policy "Allow prototype humor image updates"
  on storage.objects
  for update
  using (bucket_id = 'humor-images')
  with check (bucket_id = 'humor-images');

create policy "Allow prototype humor image deletes"
  on storage.objects
  for delete
  using (bucket_id = 'humor-images');

-- ============================================================
-- AI 상담 챗봇 대화 저장 (counsel_messages)
-- 주의: 이 앱은 실제 인증이 없고 anon 키 + prototype RLS라, author 필터는
-- 소프트 스코핑이다(DB가 남의 상담 열람을 강제 차단하지 못함). 다른 테이블과 동일 모델.
-- ============================================================
create table if not exists public.counsel_messages (
  id text primary key,
  session_id text,
  author text,
  mode text,
  role text,
  content text,
  partner_name text,
  created_at timestamptz default now()
);
create index if not exists counsel_messages_author_idx on public.counsel_messages (author, created_at);

alter table public.counsel_messages enable row level security;

drop policy if exists "Allow prototype counsel reads" on public.counsel_messages;
drop policy if exists "Allow prototype counsel writes" on public.counsel_messages;

create policy "Allow prototype counsel reads"
  on public.counsel_messages for select using (true);
create policy "Allow prototype counsel writes"
  on public.counsel_messages for insert with check (true);

-- 성향 진단(MBTI/DISC) + 협업 가이드 컬럼 (profiles). 모두 nullable.
alter table public.profiles add column if not exists mbti_type text;
alter table public.profiles add column if not exists mbti_scores jsonb;
alter table public.profiles add column if not exists disc_type text;
alter table public.profiles add column if not exists disc_secondary text;
alter table public.profiles add column if not exists disc_scores jsonb;
alter table public.profiles add column if not exists collab_guide text;

-- 내 캐릭터 컬럼 (profiles). 모두 nullable — 캐릭터가 없어도 프로필은 그대로 성립한다.
-- 사람이 아니라 사물을 묻는 값들이다. 나이·외모는 일부러 저장하지 않는다.
alter table public.profiles add column if not exists avatar_kind text;    -- 동물/사물/사람
alter table public.profiles add column if not exists desk_item text;      -- 자리에 늘 있는 것
alter table public.profiles add column if not exists into_lately text;    -- 요즘 빠져 있는 것
alter table public.profiles add column if not exists energy_time text;    -- 아침/낮/밤
alter table public.profiles add column if not exists character_url text;  -- 생성된 캐릭터 이미지 URL

-- 캐릭터 이미지 버킷. 모임 포스터(gathering-images)와 같은 방식(공개 읽기).
-- 버킷만 만들면 읽기는 되지만 업로드는 RLS 에 막힌다 — storage.objects 정책이 따로 필요하다.
insert into storage.buckets (id, name, public)
values ('profile-characters', 'profile-characters', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Allow prototype character reads" on storage.objects;
drop policy if exists "Allow prototype character writes" on storage.objects;
drop policy if exists "Allow prototype character updates" on storage.objects;
drop policy if exists "Allow prototype character deletes" on storage.objects;

create policy "Allow prototype character reads"
  on storage.objects for select using (bucket_id = 'profile-characters');
create policy "Allow prototype character writes"
  on storage.objects for insert with check (bucket_id = 'profile-characters');
create policy "Allow prototype character updates"
  on storage.objects for update using (bucket_id = 'profile-characters')
  with check (bucket_id = 'profile-characters');
create policy "Allow prototype character deletes"
  on storage.objects for delete using (bucket_id = 'profile-characters');


-- =====================================================================
-- 삭제(DELETE) 정책. RLS 가 켜진 테이블은 정책이 없는 동작을 조용히 거부하고,
-- PostgREST 는 "0행 삭제"를 성공(204)으로 돌려준다. 그래서 앱의 삭제 버튼이
-- 눌리는데 아무 일도 안 일어나는 상태로 오래 있었다(2026-08 발견).
-- =====================================================================
drop policy if exists "Allow prototype issue deletes" on public.issues;
drop policy if exists "Allow prototype agenda deletes" on public.agendas;
drop policy if exists "Allow prototype action deletes" on public.action_items;
drop policy if exists "Allow prototype ballot deletes" on public.agenda_ballots;
drop policy if exists "Allow prototype profile deletes" on public.profiles;
drop policy if exists "Allow prototype account deletes" on public.accounts;

create policy "Allow prototype issue deletes"   on public.issues          for delete using (true);
create policy "Allow prototype agenda deletes"  on public.agendas         for delete using (true);
create policy "Allow prototype action deletes"  on public.action_items    for delete using (true);
create policy "Allow prototype ballot deletes"  on public.agenda_ballots  for delete using (true);
create policy "Allow prototype profile deletes" on public.profiles        for delete using (true);
create policy "Allow prototype account deletes" on public.accounts        for delete using (true);
