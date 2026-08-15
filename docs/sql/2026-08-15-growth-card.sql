-- 커리어 관리(성장 카드) 마이그레이션 — Supabase SQL Editor 에서 1회 실행.

-- 성장 목표(단기)
create table if not exists public.growth_goals (
  id             text primary key,
  owner_email    text not null,
  title          text not null,
  detail         text default '',
  due            date,
  progress       int not null default 0,   -- 0–100
  status         text not null default '진행중',
  leader_comment text default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 역량 레벨(장기) — 자가 + 리더 합의
create table if not exists public.growth_competencies (
  id           text primary key,
  owner_email  text not null,
  competency   text not null,
  self_level   int not null default 1,     -- 1–5
  leader_level int,                          -- 1–5, 합의 전 null
  evidence     text default '',
  updated_at   timestamptz not null default now(),
  unique (owner_email, competency)
);

-- 역량 레벨 변경 이력(성장 곡선용)
create table if not exists public.growth_competency_log (
  id          text primary key,
  owner_email text not null,
  competency  text not null,
  level       int not null,                 -- 1–5
  by          text not null,                -- self / leader
  at          timestamptz not null default now()
);

-- 프라이버시(후속 강화 필수): 커리어는 사적 데이터다. v1 은 앱 레벨 게이트(본인/리더만 화면 노출)로
-- 시작하되, 아래처럼 RLS 로 owner 와 그 사람의 leaders 만 SELECT 하도록 좁히는 것을 후속으로 한다.
-- (대나무숲 anon 평문 노출과 같은 계열의 위험 — 지금은 노출되므로 배포 후 빠르게 RLS 적용 권장.)
-- alter table public.growth_goals enable row level security; ... (leaders 매핑 함수 필요)
