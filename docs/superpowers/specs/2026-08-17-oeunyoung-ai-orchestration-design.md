# 오은영AI(팀 마음상담) 오케스트레이션 고도화 설계

- 날짜: 2026-08-17
- 상태: 설계(리뷰 대기)
- 선행 문서: `docs/superpowers/specs/2026-08-07-ai-counsel-chatbot-design.md`
- 대상 파일: `api/chat.ts`, `scripts/chat-proxy.mjs`, `src/aiChat.ts`, `src/features/chat/*`
- 결정 프레임: **실사용 제품 품질**(App Store/웹 실사용자). 화려함보다 지연·비용·안전의 예측가능성 우선.

---

## 1. 배경 — 현재 구조

지금 오은영AI는 **"검색 1번 + LLM 호출 1번"의 단일샷 RAG-lite**다.

- 위젯(`ChatWidget.tsx`): 두 모드를 **사용자가 탭으로 직접 선택**(🧭상담 / 📖룰확인).
- 상담: `내 성향 + 상대 성향(선택) + 유사사례`를 프롬프트에 주입 → LLM 1회.
- 유사사례(`similarCases.ts`): 임베딩 없이 **키워드 겹침 점수**로 대나무숲(Issue)·안건(Agenda) 상위 3건. Korean 조사 stoplist는 수작업.
- 룰: `src/content/*.md`(하이닉스 출입 16KB + 그라운드룰 17KB) **전체를 통째로** 프롬프트에 주입 → LLM 1회.
- 백엔드(`api/chat.ts`): OpenRouter 1회, **비스트리밍 JSON**, `maxDuration=60`. 페르소나·안전(위기신호)·서식 규칙이 **시스템 프롬프트 한 덩어리**.
- 로컬(`scripts/chat-proxy.mjs`): SSE 스트리밍. 페르소나가 **복붙 2벌**로 존재.
- 영속화(`counselStore.ts`): Supabase `counsel_messages` (anon키 소프트스코핑).

### 한계

1. **검색이 키워드 겹침** — '비슷한 뜻, 다른 단어'를 못 찾는다.
2. **룰 전체 주입** — 토큰 낭비 + 관련 없는 조항이 답을 흐린다.
3. **라우팅이 수동** — 사용자가 상담/룰을 직접 골라야 한다.
4. **안전이 프롬프트 한 줄** — 위기신호 대응이 실제 게이트가 아니라 '지시'에 불과.
5. **툴콜 없음** — 프롬프트에 미리 넣은 것만 안다(대화 중 실시간 조회 불가).
6. **페르소나 2벌 표류 위험**(서버/로컬).

---

## 2. 목표 / 비목표

### 목표
- G1. **답변 깊이·품질** — 모델 GLM-5.2로 교체 + 페르소나/추론 골격 강화.
- G2. **검색 정확도(RAG)** — pgvector 의미검색(Supabase 내장 `gte-small`).
- G3. **자동 라우팅·다단계** — 결정적 파이프라인(라우팅→검색→답변→안전).
- G4. **실데이터 툴콜** — 대화 중 프로필·안건 상태 실시간 조회(Phase 3).

### 비목표
- 스트리밍 프로덕션 전환(504 이력 있음 — 비스트리밍 유지).
- 새 외부 비밀키 도입(임베딩은 Supabase 내장으로 0개 키).
- 클라이언트(iOS/안드/웹) 3벌 로직 분기 — 백엔드 1곳으로 수렴.
- 임베딩 자동화 파이프라인의 완전 무인화(1차엔 룰 정적 임베딩 + 사례는 준자동).

---

## 3. 아키텍처 — 결정적 단계 파이프라인

큰 모델(GLM-5.2)은 **최종 답변 딱 1콜만**. 라우팅·검색엔 큰 모델을 쓰지 않는다.

```
사용자 입력 (messages 마지막 user turn)
  │
  ▼
① 라우팅 + 위기 triage        ← LLM 아님 (하이브리드)
  │   • 위기 감지: 정규식/키워드 (자·타해, 극단 표현) → 0콜
  │   • 위기 시: 상담 대신 [109·사내 EAP 안내]로 즉시 단락(short-circuit)
  │   • 상담/룰 구분: 클라 탭(mode)을 기본값으로 유지
  ▼
② 검색(RAG)                    ← LLM 아님, Supabase Edge Function 'rag-search'
  │   • 쿼리 임베딩(gte-small 384d) + pgvector 코사인 top-k
  │   • 상담: case_embeddings(대나무숲·안건)에서 top-k
  │   • 룰:  rule_chunks(md 청크)에서 top-k  ← 전체 주입 폐기
  ▼
③ 본답변 생성                   ← GLM-5.2 1콜 (강화 페르소나 + 검색결과 + 성향)
  ▼
④ 안전 후검(조건부)             ← ①이 '경계'로 표시한 경우에만 경량 재확인
  ▼
최종 JSON { ok, text } 반환 (비스트리밍, 60초 내)
```

**위기 turn**: ① → 단락(고정 안전 문구) → LLM 0~1콜.
**일반 turn**: ①(0콜) + ②(임베딩 1콜, 비GLM) + ③(GLM-5.2 1콜) = 큰 모델 1콜.

---

## 4. 단계 상세

### ① 라우팅 + 위기 triage (하이브리드, 0 LLM콜)

- **위기 감지**: 순수함수 `detectCrisis(text): boolean`. 정규식/키워드 사전(자해·자살·타해·극단 표현). 오탐 방지를 위해 부정문("죽고 싶지 않아")·관용구는 제외 규칙 포함. 감지 시:
  - 상담·답변 생성 없이 **고정 안전 응답** 반환: 자살예방상담 **109**, 사내 **EAP** 안내. 격려·비판단 톤.
  - `counsel_messages`에는 저장하되, 위기 플래그는 로깅만(진단·기록 최소화, 프라이버시).
- **상담/룰 구분**: 기존 `mode`(탭) 기본값 유지. (Phase 2에서 싼 모델 라우터를 옵션으로 얹을 수 있게 자리만 남김.)
- 순수함수라 단위테스트 용이(`aiChat.test.ts` 패턴).

### ② 검색(RAG) — Supabase pgvector + gte-small

**인프라**
- `pgvector` 확장 활성화.
- 테이블
  - `rule_chunks(id, doc, chunk_index, content, embedding vector(384), token_est)` — 정적. 스크립트로 1회 임베딩.
  - `case_embeddings(id, source['대나무숲'|'안건'], ref_id, tenant_id, title, status, snippet, content, embedding vector(384), updated_at)` — 동적(사례가 계속 쌓임).
- **Edge Function `rag-search`**: 입력 `{ mode, query, tenantId, k }`
  1. `Supabase.ai.Session('gte-small')`로 쿼리 임베딩(새 키 0).
  2. `embedding <=> query` 코사인으로 대상 테이블 top-k (+ 유사도 임계값, tenant 스코프).
  3. 상담이면 `CaseBrief[]`(현 규격 그대로), 룰이면 `{doc, content}[]` 반환.
  - 임베딩+검색을 한 함수에 두어 Vercel에서 **1왕복**.

**임베딩 생성**
- 룰: 청크(문단/헤더 단위, ~500토큰) → 스크립트가 Edge Function `embed` 1회 실행해 채움.
- 사례: Supabase "automatic embeddings" 레시피(트리거 → `pgmq` 큐 → `pg_cron` → Edge `embed`)로 insert/update 시 준자동. 1차엔 재색인 스크립트로 채우고 자동화는 뒤이어.
- **폴백**: `rag-search` 실패/미구축 시 기존 `similarCases.ts` 키워드 검색으로 안전 폴백(앱 안 깨짐).

**검색 위치 결정**: 클라이언트가 `cases`를 조립해 보내던 것을 **서버(api/chat.ts)가 직접 검색**하도록 이전 → iOS/안드/웹이 자동으로 같은 품질. 클라는 `tenantId`만 body에 추가. (기존 `cases` 필드는 하위호환으로 당분간 수용하되 서버 검색을 우선.)

### ③ 본답변 생성 (GLM-5.2 1콜)

- 모델: `OPENROUTER_MODEL` env → GLM-5.2 슬러그(OpenRouter 정확 슬러그는 배포 시 확인). 기본값 폴백은 유지.
- **페르소나 강화(G1)**: 기존 3단 골격(감정인정→성향번역→다음 한 걸음) 유지 + DISC/MBTI를 '상대의 언어'로 번역하는 지침 구체화 + 소수 few-shot 예시(과장·진단 금지 경계 포함). 서식 규칙(`FORMAT_RULES`)은 세 렌더러 호환이라 그대로.
- 룰 모드: 전체 주입 대신 `rule_chunks` top-k만 주입(출처 doc 명시).

### ④ 안전 후검 (조건부)

- ①에서 '경계'(위기 아님, but 민감)로 표시된 경우에만 실행.
- 경량 검사(정규식 + 필요 시 짧은 LLM 확인)로 의료·심리 '진단', 특정인 비하가 새어나갔는지 점검 → 있으면 완충 문구로 교정. 평시엔 skip(지연 0).

---

## 5. 코드 구조

`api/chat.ts`를 오케스트레이터로, 로직은 순수/얇은 모듈로 분리:

```
api/chat.ts                 # 오케스트레이터(파이프라인 배선) + POST 핸들러
lib/counsel/
  persona.ts                # PERSONA / RULE_PERSONA / FORMAT_RULES (단일 출처)
  route.ts                  # detectCrisis(), triage()  — 순수함수
  retrieve.ts               # rag-search 호출 + 폴백(keyword) 래퍼
  safety.ts                 # 조건부 후검
  buildMessages.ts          # 시스템 프롬프트 조립
```

- **페르소나 2벌 제거**: `scripts/chat-proxy.mjs`와 `api/chat.ts`가 `lib/counsel/persona.ts`를 공유(런타임 차이는 import 경계로 흡수). 로컬 SSE 프록시도 같은 파이프라인 함수를 재사용해 표류 방지.
- `similarCases.ts`는 폴백으로 존치(서버 RAG 실패 시).
- Vercel 함수의 Supabase 접근: `SUPABASE_URL` + `SUPABASE_ANON_KEY`(공개, 이미 사용 중) 재사용. RAG 검색은 `SECURITY DEFINER` 읽기 함수로 최소 권한.

---

## 6. 지연·비용 예산

| 시나리오 | LLM콜(큰 모델) | 비-LLM | 예상 지연 |
|---|---|---|---|
| 위기 turn | 0 | regex | 즉시 |
| 일반 상담/룰 | 1 (GLM-5.2) | 임베딩+벡터검색 1왕복(~150ms) | GLM-5.2 응답시간 + ~0.2s |
| 경계 turn | 1~2 | 후검 | +경량 1콜 |

- 60초 `maxDuration` 내 여유. 큰 모델 1콜 원칙으로 비용도 현재와 유사(모델 단가 차이만).
- GLM-5.2가 haiku보다 느릴 수 있으므로 클라의 shimmer 타이핑 인디케이터 유지.

---

## 7. 안전·프라이버시

- 위기 단락은 **진단이 아니라 자원 안내**. 대화는 저장하되 위기 플래그는 서버 로깅 최소화.
- RAG는 **tenant 스코프** 필수(남 팀 사례 유출 금지). 상담 대화 자체는 기존 소프트스코핑 신뢰모델 유지(별도 변경 없음).
- 룰 답변은 출처 doc를 밝혀 환각 억제(기존 규칙 계승).

---

## 8. 테스트 전략

- 순수함수 단위테스트: `detectCrisis`(오탐/미탐 코퍼스), `buildMessages`(모드별 주입), 청크커.
- 계약 테스트: `rag-search` 입출력 규격, 폴백 경로(서버 다운 시 keyword).
- 회귀: 기존 `aiChat.test.ts`, `Markdownish.test.tsx` 유지 + 서식 규칙 위반(별표 노출) 스냅샷.
- 수동 E2E: 실 Supabase에 샘플 사례/룰 임베딩 후 상담·룰·위기 3플로우 시뮬레이터 확인.

---

## 9. 단계별 출시(Phasing)

**Phase 1 — 품질 최대·리스크 최소 (백엔드만)**
- GLM-5.2 교체(env) + 페르소나/골격 강화.
- 룰 모드 청크 검색(`rule_chunks` + `rag-search`)로 전체 주입 폐기.
- 위기 휴리스틱 단락(`detectCrisis`).
- 페르소나 단일 출처화(서버/로컬 공유).
- → 웹·iOS·안드 동시 수혜, 새 키 0.

**Phase 2 — 상담 RAG + (옵션)LLM 라우터**
- `case_embeddings` + 준자동 임베딩, 상담 유사사례를 서버 RAG로 이전.
- 필요 시 싼 모델 라우터를 ① 자리에 얹어 탭 자동판별.

**Phase 3 — 실데이터 툴콜**
- ②~③ 사이 "1라운드 한정" 툴콜(프로필/안건 상태 실시간). GLM-5.2 함수콜 사용.

---

## 10. 리스크 & 오픈 이슈

- **GLM-5.2 OpenRouter 슬러그·함수콜 지원**: 배포 전 실측 확인. 함수콜 편차 시 Phase 3 조정.
- **gte-small 384d의 한국어 품질**: 소규모 코퍼스엔 충분 예상. 부족하면 하이브리드(키워드+벡터 리랭크)로 보강.
- **사례 임베딩 자동화**: 1차 수동/스크립트, 자동화는 automatic-embeddings 레시피로 후속.
- **Vercel↔Supabase 지연**: 리전 차이 시 임베딩 왕복 지연 — 필요 시 Edge Function 리전 정렬.

## 11. 롤백

- 모델: `OPENROUTER_MODEL` 되돌리면 즉시 원복.
- RAG: `rag-search` 비활성 시 `similarCases.ts` 키워드로 자동 폴백 → 파이프라인은 살아있음.
- 각 Phase가 독립 배포 가능(다크런치/피처플래그 여지).
