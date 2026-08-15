-- 익명 대나무숲 글 E2E 암호화 마이그레이션
-- Supabase SQL Editor 에서 1회 실행. (anon 키로는 DDL 불가 — 서비스/대시보드 권한 필요)

-- ── 리더 키페어 (개인키는 암호문만 저장) ──
create table if not exists public.leader_keys (
  account_id          text primary key references public.accounts(id) on delete cascade,
  public_key          text not null,          -- ECDH P-256 공개키(JWK, base64/json)
  enc_priv_passphrase text not null,          -- 패스프레이즈로 감싼 개인키
  enc_priv_recovery   text not null,          -- 복구코드로 감싼 개인키
  salt_pass           text not null,
  salt_recovery       text not null,
  alg                 text not null,
  created_at          timestamptz not null default now()
);

alter table public.leader_keys enable row level security;

-- 공개키는 누구나 읽어야 암호화가 가능(제출자가 대상 리더 공개키로 암호화).
-- 감싼 개인키도 암호문이라 노출돼도 무의미하므로 select 는 전체 허용.
drop policy if exists leader_keys_read on public.leader_keys;
create policy leader_keys_read on public.leader_keys for select using (true);

-- 리더가 자기 키를 최초 1회 등록(anon 경로). update/delete 는 정책 없음 → 막힘(서비스 롤만).
drop policy if exists leader_keys_insert on public.leader_keys;
create policy leader_keys_insert on public.leader_keys for insert with check (true);

-- ── issues 암호화 컬럼 ──
alter table public.issues add column if not exists encrypted   boolean not null default false;
alter table public.issues add column if not exists enc_payload text;      -- 암호문(iv||ciphertext, base64)
alter table public.issues add column if not exists enc_keys    jsonb;     -- 리더별 감싼 콘텐츠키 배열
alter table public.issues add column if not exists enc_alg     text;      -- 알고리즘 버전 태그

-- 확인용:
-- select column_name from information_schema.columns where table_name='issues' and column_name like 'enc%';
-- select * from information_schema.tables where table_name='leader_keys';
