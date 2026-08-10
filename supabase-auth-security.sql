-- =====================================================================
-- SKonnection 비밀번호 보안 강화 (2026-08-10)
-- SQL Editor 에 통째로 실행. 아래 4가지를 한다.
--   1. 첫 로그인 비번 변경 강제용 플래그
--   2. 초기화 인증번호 저장 테이블 (anon 접근 완전 차단 — 서버만)
--   3. **계정 탈취 구멍 차단** — anon 이 password_hash 를 못 쓰게 REVOKE
--   4. 지금까지의 계정(전부 123123)을 "변경 필요"로 표시
--
-- 이 스크립트 전에 반드시: Vercel 환경변수에 SUPABASE_SERVICE_ROLE_KEY 추가.
-- (Supabase 대시보드 → Project Settings → API → service_role 키 복사)
-- =====================================================================

-- ── 1. 비번 변경 강제 플래그 ──────────────────────────────────────
-- 기본 true: 새로 만든 계정도 첫 로그인 때 반드시 새 비번을 정하게 된다.
alter table public.accounts
  add column if not exists must_change_password boolean not null default true;

-- ── 2. 초기화 인증번호 저장소 ────────────────────────────────────
-- 코드는 평문이 아니라 해시로 저장한다(테이블이 새도 대입이 어렵게).
-- RLS 를 켜고 정책을 하나도 안 만든다 → anon 은 읽기·쓰기 전부 거부된다.
-- 서버 함수만 service_role 키로 접근한다.
create table if not exists public.password_resets (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.password_resets enable row level security;
-- (정책 없음 = anon 전면 차단. service_role 은 RLS 를 우회한다.)
revoke all on public.password_resets from anon;

-- ── 3. 계정 탈취 구멍 차단 (제일 중요) ───────────────────────────
-- 지금은 공개 anon 키로 누구나 남의 password_hash 를 덮어써 로그인할 수 있다.
-- 비번 관련 컬럼의 쓰기 권한을 anon 에서 회수한다. 이제 비번 변경·초기화는
-- 오직 서버 함수(service_role)를 통해서만 가능하다.
-- (읽기는 남겨둔다 — 웹/iOS/안드로이드가 아직 클라이언트에서 로그인 검증을 하므로.
--  읽기까지 막는 건 세 앱이 전부 서버 로그인으로 옮겨간 다음 단계에서 한다.)
revoke update (password_hash, must_change_password) on public.accounts from anon;

-- 계정 관리 화면(이름·역할·파트 수정)은 계속 anon 으로 동작해야 하므로,
-- 나머지 컬럼의 update 권한은 명시적으로 유지한다.
grant update (name, email, role, part, status, joined_at, photo_url,
              is_connectioner, slack_email, updated_at) on public.accounts to anon;

-- ── 4. 기존 계정을 "변경 필요"로 ─────────────────────────────────
-- 전부 123123 이므로 모두 표시한다. 컬럼 기본값이 true 지만, 이미 만들어진
-- 행에는 기본값이 소급되지 않으므로 명시적으로 채운다.
update public.accounts set must_change_password = true;
