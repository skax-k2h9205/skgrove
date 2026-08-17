# 오은영AI Phase 2 — 상담 사례 RAG 설계

- 날짜: 2026-08-17
- 상태: 설계(리뷰 대기)
- 상위 스펙: `docs/superpowers/specs/2026-08-17-oeunyoung-ai-orchestration-design.md`
- 선행: Phase 1a(위기게이트·페르소나, 16004d1), Phase 1b(룰 RAG 인프라, 24298ec — pgvector·gte-small Edge·폴백 패턴 검증 완료)
- 대상: `supabase/`(마이그레이션·함수 확장), `lib/counsel/retrieve.js`, `api/chat.ts`, `src/aiChat.ts`(tenantId 1필드), `scripts/backfill-case-embeddings.mjs`

---

## 1. 목표 / 비목표

### 목표
- 상담 모드의 유사사례를 **클라 키워드 겹침 → 서버 pgvector 의미검색**으로 교체("비슷한 뜻, 다른 단어"를 찾음).
- 사례는 동적 데이터 — **DB 트리거로 준실시간 색인**(행당 임베딩 1회 = 1b에서 실측한 Edge 한도에 정합).
- **프라이버시를 현재보다 강화**: `리더만 보기` 제외, E2E 암호글은 제목·상태만.
- 1b 인프라(가드·폴백·시크릿 패턴) 재사용 — 새 패턴 최소화.

### 비목표
- LLM 라우터(탭 자동판별) — 후속.
- 청킹 — 사례는 짧아 **1행 = 1임베딩**(청커 불필요).
- iOS/안드 클라 변경 — tenantId 없이 호출하면 기존 폴백(클라 전송 cases) 유지.

## 2. 확정 결정
- **색인 범위(프라이버시)**: 이슈는 `visibility='안건 후보로 공개 가능'`만 본문 포함, `리더만 보기`는 **색인 제외**(기존재 시 삭제). E2E 암호글(encrypted)은 DB에 body=''라 자연히 제목·카테고리·상태만. 안건은 전체.
- **갱신**: `issues`/`agendas` INSERT·UPDATE(·DELETE) 트리거 → `pg_net`으로 Edge `reindex-cases`에 **행 1개 POST**. 기존 데이터는 백필 스크립트 1회.
- **검색 위치**: 서버(api/chat.ts) — 웹·iOS·안드 공통 수혜. 실패/미설정/타임아웃 → **클라가 보낸 cases(키워드 결과)로 폴백**(오늘보다 나빠지지 않음).

## 3. 아키텍처

```
[색인]  issues/agendas 행 변경
          └─ trigger → pg_net POST { source, refId } + x-reindex-secret
               └─ Edge reindex-cases: 행 읽기(service_role) → 정책 적용(제외/제목만/전체)
                    → gte-small 임베딩 1회 → case_embeddings upsert(제외면 delete)
[백필]  scripts/backfill-case-embeddings.mjs — id 목록 조회 후 행당 1 POST(1b BATCH=1 패턴·재시도·건수 검증)

[질의]  상담 turn (api/chat.ts, 위기 단락 이후)
          └─ body.tenantId 있으면 rag-search { scope:'cases', query:lastUser, tenantId, matchCount:6 }
               └─ match_case_chunks RPC(tenant 필터) → CaseBrief[]로 변환 → body.cases 교체
          └─ null(실패·빈결과·미설정·tenantId 없음) → 클라 전송 cases 그대로(폴백)
```

## 4. DB (새 마이그레이션)

- `create extension if not exists pg_net;` (vault는 Supabase 기본 제공)
- 테이블 `case_embeddings`:
  - `source text not null check (source in ('issue','agenda'))`, `ref_id text not null`, `primary key (source, ref_id)`
  - `tenant_id text`, `title text not null`, `status text not null`, `snippet text not null`(≤80자, 현재 CaseBrief 규격), `content text not null`(임베딩 원문), `embedding vector(384)`, `updated_at timestamptz default now()`
  - HNSW cosine 인덱스. RLS enable(정책 없음 = 전면 거부).
- RPC `match_case_chunks(query_embedding vector(384), p_tenant text, match_count int default 6)`
  - `where tenant_id is not distinct from p_tenant` + 코사인 정렬 + limit. SECURITY DEFINER, search_path 고정, **PUBLIC/anon/authenticated EXECUTE revoke**(1b lockdown 패턴 그대로).
- 트리거 함수 `notify_case_change()`:
  - `issues`·`agendas` AFTER INSERT OR UPDATE OR DELETE. Vault에서 `functions_url`·`reindex_secret`·`anon_key` 조회 → `net.http_post(reindex-cases, {source, refId}, headers)`. DELETE면 refId만(함수가 행 없음 → 색인 삭제로 처리).
  - Vault 시드는 런북의 1회 SQL(마이그레이션에 시크릿 넣지 않음).

## 5. Edge Functions

### `reindex-cases` (신규)
- 인증: 1b와 동일 — `x-reindex-secret` 필수(fail-closed 401).
- 입력 `{ source:'issue'|'agenda', refId }` 1건. service_role로 원본 행 조회:
  - 없음 → `case_embeddings`에서 delete → `{ok:true, action:'deleted'}`
  - **정책(순수함수 `caseContentOf`, 공유 모듈로 두고 vitest 테스트)**:
    - issue: `visibility !== '안건 후보로 공개 가능'` → 제외(delete). encrypted → content=`title` (+category/status), snippet=title. 평문 → content=`title+body+expectedChange`(1200자 캡), snippet=body 80자.
    - agenda: content=`title+description`(1200자 캡), snippet=description 80자.
  - 임베딩 1회 → upsert. `{ok:true, action:'upserted'}`
- 입력이 1건이라 Edge 한도(요청당 임베딩 1개) 안전.

### `rag-search` (확장)
- 입력에 `scope?: 'rules'|'cases'`(기본 'rules'), `tenantId?` 추가.
- cases면 `match_case_chunks(embedding, tenantId, matchCount)` 호출, `{doc→source, ...}` 대신 `{source, refId, title, status, snippet}` 반환(CaseBrief 규격).
- rules 경로·countOnly는 불변(회귀 없음).

## 6. 앱 배선

- `lib/counsel/retrieve.js`: `retrieveCases(query, {functionsUrl, anonKey, tenantId, matchCount=6, timeoutMs=5000, fetchImpl})` — null 폴백·타임아웃 등 `retrieveRuleChunks`와 동일 계약. CaseBrief 배열 반환.
- `api/chat.ts`: 상담 모드 + `SUPABASE_URL/ANON_KEY` + `body.tenantId` 있으면 `retrieveCases` → 성공 시 `effectiveBody.cases` 교체. 실패 시 클라 cases 유지. (룰 모드 배선과 대칭.)
- `src/aiChat.ts`: `ChatRequest`에 `tenantId?: string` 추가, ChatWidget이 `getCurrentTenantId()` 값 전달. `findSimilarCases`는 폴백 소스로 존치.
- `scripts/chat-proxy.mjs`: 변경 없음(로컬은 클라 cases 그대로 — env 없으면 서버도 동일 폴백이라 규약 일치).

## 7. 프라이버시·보안
- 리더 전용 글 미색인(현재 클라 동작보다 강화). 암호글 본문은 서버에 아예 없음(이중 안전).
- 색인 쓰기: 시크릿 헤더(1b REINDEX_SECRET 재사용). 읽기: RPC revoke + Edge 경유만.
- tenant 필터는 RPC 내부(WHERE) — 호출자가 남 테넌트를 못 긁음(단, tenantId 자체는 클라 신고값 — 기존 소프트스코핑 신뢰모델과 동일 수준).

## 8. 테스트
- `caseContentOf` 순수함수: 4분기(공개평문/암호/리더만/안건) + 캡·snippet.
- `retrieveCases`: 성공/빈/오류/타임아웃/tenantId 누락 → null 폴백, matchCount 기본 6.
- api 배선: 상담 모드 회귀(475+ 유지), 룰 경로 불변.
- 라이브: 백필 후 실사례 질문으로 검색 적중 + 트리거(이슈 1건 등록→색인 반영) + 리더만보기 미색인 확인.

## 9. 런북 (배포 순서)
1. (Claude) 마이그레이션·함수·스크립트·배선 작성, 테스트.
2. (사용자, 토큰) `supabase db push` + `supabase functions deploy rag-search reindex-cases`.
3. (사용자 1회 SQL — 대시보드/psql) Vault에 `functions_url`·`reindex_secret`·`anon_key` 시드(런북에 SQL 제공).
4. (Claude) 백필 실행·검증, 트리거 스모크(테스트 행), rag-search cases 스모크.
5. dev 머지·push. Vercel env는 1b와 동일 2개(이미 투두) — 미설정 시 전부 폴백 동작.

## 10. 리스크
- **pg_net/Vault 첫 사용**: 트리거→Edge 배선이 이 repo 최초. 실패 시에도 색인만 늦을 뿐 상담은 폴백으로 동작(비차단). 백필 스크립트가 수동 복구 수단.
- **tenantId 신뢰**: 클라 신고값(기존 신뢰모델 동일). 서버 인증 도입 시 JWT 유래로 교체 여지.
- **iOS/안드**: tenantId 미전송 → 폴백(클라 cases). 추후 1필드 추가로 활성화.

## 11. 롤백
- Vercel env 제거 → 상담도 클라 cases 폴백(즉시). 트리거는 `drop trigger` 마이그레이션으로 중단 가능. case_embeddings 잔존은 무해.
