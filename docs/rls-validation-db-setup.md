# RLS 검증 DB 리허설 가이드 (Stage 2b)

운영(SK 32명 사용 중)에 RLS를 바로 켜면 실수 시 전원 락아웃. 그래서 **빈 검증용 Supabase 프로젝트**에서 먼저 리허설하고, 통과한 **동일 SQL**을 운영에 적용한다.

## 1) 검증 프로젝트 생성
- Supabase 대시보드 → **New Project** (무료 플랜, 5분). 데이터는 비어 있어도 됨(격리 테스트라 스키마만 필요).
- 생성 후 **Project URL / anon key / service_role(secret) key** 를 메모.

## 2) 스키마 복제 — SQL Editor 에 아래 순서로 실행
각 파일 내용을 복사해 실행. 중간에 "테이블 없음" 에러가 나면 그 테이블을 만드는 파일을 먼저 실행.

1. `supabase-schema.sql` — 기본 테이블 + 스토리지 5버킷 + (개방)RLS
2. `supabase-auth-security.sql` — password_resets 등
3. `docs/sql/2026-08-15-growth-card.sql` — growth 테이블
4. `docs/sql/2026-08-15-anon-encryption.sql` — leader_keys (대나무숲 리더키)
5. `supabase-tenants.sql` — tenants 테이블 + 전 테이블 tenant_id + 백필(tenant#1)
6. `supabase-drop-part-check.sql` — SK 파트 CHECK 제거
7. `supabase-tenant-remaining.sql` — app_config PK, growth·leader_keys tenant_id
   - (선택) `supabase/migrations/*` 는 RAG용 — 격리 테스트엔 불필요, 생략 가능

> 운영과 동일 스키마를 만드는 게 목적. 위 7개면 앱 테이블은 모두 생성된다.

## 3) 테스트 데이터 심기 (2개 테넌트 + 계정)
`scripts/seed-test-tenant.mjs` 를 **검증 프로젝트 키로** 실행하면 '테스트팀'(TEST-01) + test1/test2 가 생긴다.
추가로 SK 역할의 2번째 테넌트도 하나 만들어 서로 안 보이는지 볼 것. 각 계정에 **auth_uid 가 채워지는지** 확인(seed 가 채움).

```
SUPABASE_URL=https://<검증ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<검증 secret> \
node scripts/seed-test-tenant.mjs
```

선결 audit(0건이어야 함):
```sql
select id,email from public.accounts where (auth_uid is null or tenant_id is null) and status='활성';
```

## 4) RLS 적용
`supabase-rls-lockdown.sql` 전체를 SQL Editor 에 실행.

## 5) 격리 검증 (핵심 — 여기서 다 통과해야 운영 적용)
- **로그인**: test1(테스트팀)으로 로그인 → 정상 진입(락아웃 X).
- **격리**: test1 화면에 SK 데이터가 안 보이고, SK 계정엔 테스트팀 데이터가 안 보임.
- **가입**: 세션 없이 초대코드로 팀 조회(tenants anon 읽기) → 신규 가입 → 로그인 매칭(중복 X).
- **대나무숲**: 익명 접수/투표 정상. 익명 행에 신원 없음. 리더 공개키 읽기(암호화) 동작.
- **anon 직접 호출**: 브라우저 콘솔에서 `supabase.from('issues').select()` → **빈 결과**(격리 확인).
- **플랫폼 오너**: is_platform_owner 계정은 전 테넌트가 보임.
- **스토리지**: 다른 테넌트 폴더 파일 접근 차단.
- 앱: `npm run build` / 테스트 통과.

## 6) 운영 적용
검증에서 전부 통과하면:
1. 운영에서 선결 audit 재확인(0건).
2. `supabase-rls-lockdown.sql` **동일 파일**을 운영 SQL Editor 에 실행.
3. 즉시 스모크: 로그인·글쓰기·파일 업로드·대나무숲 접수.

## 7) 롤백 (문제 시 즉시)
`supabase-rls-lockdown.sql` 하단 주석의 **롤백 블록**을 실행하면 개방 상태로 복구된다(몇 초).
