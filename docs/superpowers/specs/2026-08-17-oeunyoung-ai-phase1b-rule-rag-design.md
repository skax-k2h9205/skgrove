# 오은영AI Phase 1b — 룰 RAG 설계

- 날짜: 2026-08-17
- 상태: 설계(리뷰 대기)
- 상위 스펙: `docs/superpowers/specs/2026-08-17-oeunyoung-ai-orchestration-design.md`
- 선행: Phase 1a(위기 게이트·페르소나 단일출처·GLM-5.2) — dev 배포 완료(16004d1)
- 대상: `supabase/`(신규), `lib/counsel/retrieve.js`(신규), `api/chat.ts`, `src/aiChat.ts`, `scripts/seed 로직은 Edge Function으로`

---

## 1. 목표 / 비목표

### 목표
- 룰 모드 답변이 **관련 룰 청크만 의미검색으로 주입**(전체 33KB 주입 폐기) → 쿼리당 토큰 절감.
- **correctness 우선**: 고회수율(top-k 넉넉) + 실패/저신뢰 시 **전체주입 폴백** → 오늘보다 나빠지지 않음.
- RAG 인프라(pgvector + gte-small + Edge Function)를 **정적·통제된 룰 코퍼스로 먼저 구축·검증** → Phase 2(상담 사례)가 같은 인프라 재사용.

### 비목표
- 상담 사례 RAG(Phase 2).
- 새 외부 임베딩 키(Supabase 내장 gte-small 사용 → 키 0).
- 클라이언트 임베딩(서버/Edge에서만). 클라는 폴백용 전체 지식만 계속 실어보냄.

---

## 2. 결정 사항(확정)

- **임베딩·검색 위치**: Supabase Edge Function + 내장 `gte-small`(384차원). Vercel 함수는 가벼운 HTTP 호출만(지연·의존성 최소, 벡터 일관성 보장).
- **프로비저닝**: 사용자가 `supabase login` + `supabase link --project-ref sjymcpjbmsqapsptvlml`(DB 비번은 사용자 환경에서만). 이후 Claude가 인증된 CLI로 마이그레이션·함수 배포·시드 수행.
- **고회수율**: `match_count = 20`(전체 ~136 청크 중) 기본 → 검색미스 확률 최소.
- **폴백**: Edge Function 오류/빈 결과/미설정 시 기존 전체주입(`body.knowledge`) 사용.

---

## 3. 아키텍처

```
[룰 모드 질문]
  api/chat.ts
    └─(SUPABASE env 있으면)→ POST Supabase Edge Function `rag-search` { query, matchCount:20 }
         Edge Function (Deno):
           1) gte-small 로 query 임베딩(384d)
           2) service_role 로 rule_chunks 코사인 검색 order by embedding <=> q limit 20
           3) { chunks:[{doc,heading,content}] } 반환
    └─ 청크로 knowledge 문자열 구성 → buildSystemContent({mode:'rule', knowledge})
    └─(실패/빈결과/미설정)→ body.knowledge(전체주입) 폴백
  → GLM-5.2 1콜 → 답변
```

시드(오프라인, 1회/룰변경시):
```
[src/content/*.md]  →  Edge Function `reindex-rules`(md 번들)  →  청킹→gte-small 임베딩→rule_chunks upsert
  실행: supabase functions invoke reindex-rules
```

---

## 4. 데이터베이스 (마이그레이션 SQL)

`supabase/migrations/<ts>_rule_rag.sql`:
- `create extension if not exists vector;`
- 테이블 `rule_chunks`:
  - `id uuid primary key default gen_random_uuid()`
  - `doc text not null` (예: 'team-ground-rules.md')
  - `heading text not null` (섹션 헤딩 경로, 예: '3. 예산 > 3.2 의욕관리비')
  - `content text not null`
  - `embedding vector(384)`
  - `updated_at timestamptz not null default now()`
- 인덱스: `create index rule_chunks_embedding_idx on rule_chunks using hnsw (embedding vector_cosine_ops);`
- RLS: 테이블 직접 접근 불필요(Edge Function이 service_role로 읽음). anon 직접 select는 막아둔다(민감치 않으나 최소권한).

---

## 5. Edge Functions (Deno)

### `supabase/functions/rag-search/index.ts` (쿼리)
- 입력 JSON: `{ query: string, matchCount?: number }`
- `const session = new Supabase.ai.Session('gte-small')` → `await session.run(query, { mean_pool: true, normalize: true })` → 384d 벡터.
- service_role supabase 클라이언트로:
  `select doc, heading, content from rule_chunks order by embedding <=> '[...]' limit matchCount` (pgvector 연산자; supabase-js `rpc` 또는 `.rpc('match_rule_chunks', ...)`).
  - 구현 단순화를 위해 RPC `match_rule_chunks(query_embedding vector(384), match_count int)`를 마이그레이션에 함께 정의(코사인 정렬 + limit)하고 Edge Function은 이 RPC를 호출.
- 반환: `{ ok:true, chunks:[{doc,heading,content}] }` 또는 `{ ok:false, reason }`.
- 인증: 기본 verify_jwt=true. 호출자는 anon 키를 Bearer로 전달(anon 키는 공개, 유효 JWT).

### `supabase/functions/reindex-rules/index.ts` (시드/재색인)
- 룰 md를 **함수에 번들**(deploy 시 src/content 사본 포함) 또는 요청 본문으로 청크 수신.
- 채택: **번들** — 함수 디렉토리에 `_content/*.md` 복사. 온-인보크 시: 청킹 → 각 청크 gte-small 임베딩 → `delete from rule_chunks` 후 `insert`.
- 인증: service_role 필요(쓰기). `supabase functions invoke reindex-rules`는 service_role 컨텍스트로 실행.

**청킹 규칙**(pure, 테스트 대상): 마크다운을 `#`/`##`/`###` 헤딩 경계로 분할, 각 청크에 헤딩 경로 부착. 200자 미만 청크는 직전 청크에 병합, 1500자 초과는 `###` 하위경계로 재분할. 목표 300~800자.

---

## 6. 애플리케이션 배선

### `lib/counsel/retrieve.js` (신규, 서버측)
- `export async function retrieveRuleChunks(query, { functionsUrl, anonKey, matchCount = 20 })`
  - Edge Function `rag-search` 호출 → 성공 시 `[{doc,heading,content}]`, 실패 시 `null`(폴백 신호).
  - 순수 로직(HTTP)만; fetch 주입 가능하게 하여 단위테스트.
- `export function knowledgeFromChunks(chunks)` → 청크 배열을 룰 모드 지식 문자열로(문서·헤딩 표기 포함). buildSystemContent의 knowledge 로 넣음.

### `api/chat.ts` (룰 모드)
- env `SUPABASE_URL`(→functionsUrl 유도) + `SUPABASE_ANON_KEY` 존재 시:
  - `const chunks = await retrieveRuleChunks(lastUser, {...})`
  - `chunks` 있으면 `body = { ...body, knowledge: knowledgeFromChunks(chunks) }` 로 교체 후 buildSystemContent.
  - `chunks == null`(실패) → 기존 `body.knowledge`(전체주입) 그대로 → 폴백.
- env 미설정(로컬 등) → 항상 폴백(전체주입). 앱 안 깨짐.

### `src/aiChat.ts` (클라이언트)
- 변경 없음 또는 최소 — 룰 모드에서 여전히 `RULE_KNOWLEDGE`(전체)를 body.knowledge로 실어보냄(서버 RAG 실패 시 폴백 소스). 서버가 성공하면 이 값을 무시하고 청크로 덮어씀.

---

## 7. 지연·비용

- 룰 쿼리: Edge Function 1왕복(임베딩~수십ms + 벡터검색~ms) + GLM-5.2 1콜. 60초 내 여유.
- 토큰: 전체 ~15–25K → top-20 청크 ~3–6K. 쿼리당 절감. 검색 실패 시에만 전체(폴백).

## 8. 보안·프라이버시

- 룰 문서는 팀 공개 정보(민감치 않음). anon 키로 Edge Function 호출(공개 키, 문제 없음).
- 쓰기(reindex)는 service_role만. rule_chunks 직접 anon 접근 차단.

## 9. 테스트

- `chunkMarkdown` 순수함수 단위테스트(헤딩 분할·병합·재분할·헤딩경로).
- `retrieve.js` 단위테스트(fetch 목: 성공 파싱 / 오류 시 null 폴백 / knowledgeFromChunks 포맷).
- Edge Function: 로컬/배포 후 통합 검증(`supabase functions serve` 또는 배포 후 invoke). 유닛 대상 아님.
- E2E: 시드 후 실제 룰 질문 2~3건으로 관련 청크가 잡히는지 + 폴백 경로.

## 10. 배포 런북 (사용자 login 후 Claude 실행)

1. (사용자) `supabase login` + `supabase link --project-ref sjymcpjbmsqapsptvlml`.
2. (Claude) `supabase init`(supabase/ 생성), 마이그레이션 작성 → `supabase db push`.
3. (Claude) `supabase functions deploy rag-search reindex-rules`.
4. (Claude) `supabase functions invoke reindex-rules` → rule_chunks 시드.
5. (사용자) Vercel Production env `SUPABASE_URL`, `SUPABASE_ANON_KEY` 설정.
6. dev push → 웹 배포. 룰 질문으로 검증. 이상 시 env 제거하면 전체주입 폴백으로 즉시 롤백.

## 11. 리스크

- **gte-small 한국어 품질**: 부족하면 match_count↑ 또는 하이브리드(키워드 필터+벡터). 고회수율로 1차 방어.
- **Supabase.ai gte-small 가용성**: Edge 런타임에서 지원 확인 필요(배포 시 검증). 미지원 시 대체: Edge Function 내 transformers.js(Xenova/gte-small).
- **CLI 인증 게이트**: 사용자 login 전엔 배포 불가 — 코드/SQL은 선작성, 배포만 대기.
- **벡터 일관성**: 쿼리·문서 임베딩 모두 동일 gte-small(Edge) → 일관 보장.

## 12. 롤백

- Vercel env(SUPABASE_*) 제거 → api/chat.ts가 전체주입 폴백으로 즉시 복귀. Edge Function/테이블은 남아도 무해.
