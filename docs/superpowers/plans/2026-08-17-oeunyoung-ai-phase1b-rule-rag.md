# 오은영AI Phase 1b — 룰 RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 룰 모드 답변이 전체 33KB 대신 관련 룰 청크만 의미검색으로 주입하도록, Supabase Edge Function(내장 gte-small)+pgvector RAG를 구축하고 api/chat.ts에 배선한다(실패 시 전체주입 폴백).

**Architecture:** 룰 질문 → api/chat.ts가 Supabase Edge Function `rag-search` 호출 → gte-small 쿼리 임베딩 + pgvector 코사인 top-20 → 관련 청크만 주입 → GLM-5.2. 시드는 Node 스크립트가 로컬 md를 청킹해 Edge Function `reindex-rules`로 보내 임베딩·삽입. 청킹·retrieve·wiring은 순수 로직으로 vitest 테스트, Edge Function은 배포 후 통합 검증.

**Tech Stack:** Supabase(pgvector, Edge Functions/Deno, 내장 gte-small), ESM `.js` 공유 모듈, vitest, Vercel 서버리스(api/chat.ts).

**Spec:** `docs/superpowers/specs/2026-08-17-oeunyoung-ai-phase1b-rule-rag-design.md`

## Global Constraints

- 프로덕션 비스트리밍 JSON 유지, maxDuration=60.
- 새 외부 임베딩 키 0 — Supabase 내장 gte-small(384차원)만.
- **correctness 우선**: match_count 기본 20(전체 ~136 청크), Edge Function 오류/빈결과/env미설정 시 **기존 전체주입(body.knowledge) 폴백** — 오늘보다 나빠지지 않는다.
- 쿼리·문서 임베딩 모두 동일 gte-small(Edge) → 벡터 일관성.
- 순수 공유 모듈은 ESM `.js`, import 확장자 명시. Deno(Edge)와 vitest 양쪽에서 import 가능해야 함.
- 룰 문서는 팀 공개 정보. Edge Function 호출은 anon 키(공개). 쓰기(reindex)는 service_role만, rule_chunks 직접 anon 접근 차단.
- 배포/시드/Vercel env 는 사용자 `supabase login`+`link` 이후 진행(그 전엔 코드만).
- Phase 1a의 `buildSystemContent`(rule 모드 knowledge 주입) 계약을 그대로 사용 — knowledge 문자열만 청크 기반으로 교체.

---

## File Structure

- Create: `supabase/functions/_shared/chunk.js` — 마크다운 헤딩 청킹(순수).
- Create: `supabase/functions/_shared/chunk.test.ts` — 청킹 테스트.
- Create: `lib/counsel/retrieve.js` — `retrieveRuleChunks`, `knowledgeFromChunks`.
- Create: `lib/counsel/retrieve.test.ts` — retrieve 테스트(fetch 목).
- Create: `supabase/migrations/<ts>_rule_rag.sql` — pgvector + rule_chunks + 인덱스 + RPC.
- Create: `supabase/functions/rag-search/index.ts` — 쿼리 임베딩+검색(Deno).
- Create: `supabase/functions/reindex-rules/index.ts` — 청크 임베딩+삽입(Deno).
- Create: `scripts/seed-rule-chunks.mjs` — 로컬 md 청킹→reindex-rules 호출(Node).
- Modify: `api/chat.ts` — 룰 모드에서 retrieve 후 청크 주입, 실패 시 폴백.
- Config: Vercel env `SUPABASE_URL`, `SUPABASE_ANON_KEY`(사용자).

---

### Task 1: 마크다운 청킹 순수함수 (`supabase/functions/_shared/chunk.js`)

**Files:**
- Create: `supabase/functions/_shared/chunk.js`
- Test: `supabase/functions/_shared/chunk.test.ts`

**Interfaces:**
- Produces: `chunkMarkdown(md: string, doc: string): Array<{doc, heading, content}>`
  - 헤딩(`#`~`######`) 경계로 분할, 각 청크에 헤딩 경로(상위 헤딩 누적, ' > '로 연결) 부착.
  - 200자 미만 청크는 직전 청크에 병합. 1500자 초과 청크는 문단(빈 줄) 경계로 재분할.

- [ ] **Step 1: 실패하는 테스트 작성**

`supabase/functions/_shared/chunk.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { chunkMarkdown } from './chunk.js';

const MD = `# 팀 운영\n인사말 문단입니다. 이 섹션은 팀 운영 전반을 다룹니다. 충분히 길게 만들어 병합되지 않도록 합니다.\n\n## 예산\n### 의욕관리비\n의욕관리비 한도는 분기당 30만원입니다. 사용 절차는 팀장 승인 후 집행합니다. 영수증 첨부 필수입니다.\n### 전표\n전표 승인 기한은 7일입니다.\n\n## 근태\n유연근무는 코어타임 10-16시를 지킵니다. 재택은 주 2회까지 가능합니다. 사전 공유가 원칙입니다.`;

describe('chunkMarkdown', () => {
  it('헤딩 경계로 나누고 doc·heading 경로를 붙인다', () => {
    const chunks = chunkMarkdown(MD, 'team.md');
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.every((c) => c.doc === 'team.md')).toBe(true);
    const budget = chunks.find((c) => c.content.includes('의욕관리비 한도'));
    expect(budget).toBeTruthy();
    expect(budget!.heading).toContain('예산');
    expect(budget!.heading).toContain('의욕관리비');
  });

  it('200자 미만 청크는 직전 청크에 병합한다', () => {
    const chunks = chunkMarkdown(MD, 'team.md');
    // '전표'(짧음)는 단독 청크로 남지 않고 직전(예산/의욕관리비)에 병합된다
    const tiny = chunks.find((c) => c.heading.endsWith('전표') && c.content.length < 200);
    expect(tiny).toBeUndefined();
    expect(chunks.some((c) => c.content.includes('전표 승인 기한'))).toBe(true);
  });

  it('빈 입력은 빈 배열', () => {
    expect(chunkMarkdown('', 'x.md')).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run supabase/functions/_shared/chunk.test.ts`
Expected: FAIL — `Cannot find module './chunk.js'`.

- [ ] **Step 3: 최소 구현 작성**

`supabase/functions/_shared/chunk.js`:
```js
// 마크다운을 헤딩 경계로 청킹한다(순수). Deno(Edge reindex)와 vitest 양쪽에서 쓰인다.
// 목표: 300~800자 청크. 200자 미만은 직전에 병합, 1500자 초과는 문단 경계로 재분할.
// 각 청크는 상위 헤딩 누적 경로(heading)를 갖는다 — 검색 결과에 출처를 붙이기 위함.

const MIN = 200;
const MAX = 1500;

/** '## 예산' → { level:2, text:'예산' }, 아니면 null */
function parseHeading(line) {
  const m = /^(#{1,6})\s+(.*)$/.exec(line);
  return m ? { level: m[1].length, text: m[2].trim() } : null;
}

function headingPath(stack) {
  return stack.map((h) => h.text).join(' > ');
}

/** 문단(빈 줄) 경계로 큰 텍스트를 MAX 이하 조각들로 나눈다. */
function splitLong(text) {
  if (text.length <= MAX) return [text];
  const paras = text.split(/\n\s*\n/);
  const out = [];
  let buf = '';
  for (const p of paras) {
    if (buf && (buf + '\n\n' + p).length > MAX) {
      out.push(buf);
      buf = p;
    } else {
      buf = buf ? buf + '\n\n' + p : p;
    }
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * @param {string} md
 * @param {string} doc  파일명 등 출처 식별자
 * @returns {Array<{doc:string, heading:string, content:string}>}
 */
export function chunkMarkdown(md, doc) {
  if (!md || !md.trim()) return [];
  const lines = md.split('\n');
  const stack = []; // 현재 헤딩 경로
  const raw = []; // {heading, body}
  let body = [];

  const flush = () => {
    const text = body.join('\n').trim();
    if (text) raw.push({ heading: headingPath(stack), content: text });
    body = [];
  };

  for (const line of lines) {
    const h = parseHeading(line);
    if (h) {
      flush();
      while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
      stack.push(h);
    } else {
      body.push(line);
    }
  }
  flush();

  // 큰 청크 재분할
  const split = [];
  for (const c of raw) {
    for (const piece of splitLong(c.content)) split.push({ heading: c.heading, content: piece });
  }

  // 작은 청크 병합(직전에)
  const merged = [];
  for (const c of split) {
    const prev = merged[merged.length - 1];
    if (prev && c.content.length < MIN) {
      prev.content += '\n\n' + (c.heading ? `[${c.heading}]\n` : '') + c.content;
    } else {
      merged.push({ ...c });
    }
  }

  return merged.map((c) => ({ doc, heading: c.heading, content: c.content }));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run supabase/functions/_shared/chunk.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**
```bash
git add supabase/functions/_shared/chunk.js supabase/functions/_shared/chunk.test.ts
git commit -m "feat(counsel): 룰 RAG 마크다운 헤딩 청킹(순수함수)"
```

---

### Task 2: retrieve 배선 (`lib/counsel/retrieve.js`)

**Files:**
- Create: `lib/counsel/retrieve.js`
- Test: `lib/counsel/retrieve.test.ts`

**Interfaces:**
- Produces:
  - `retrieveRuleChunks(query, { functionsUrl, anonKey, matchCount=20, fetchImpl=fetch }): Promise<Array<{doc,heading,content}> | null>` — 성공 시 청크 배열, 실패/빈결과 시 `null`(폴백 신호).
  - `knowledgeFromChunks(chunks): string` — 청크를 룰 모드 knowledge 문자열로.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/counsel/retrieve.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { retrieveRuleChunks, knowledgeFromChunks } from './retrieve.js';

const ok = (chunks: unknown) =>
  vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, chunks }) }) as unknown as Response);

describe('retrieveRuleChunks', () => {
  it('성공 시 청크 배열을 반환한다', async () => {
    const chunks = [{ doc: 'team.md', heading: '예산', content: '한도 30만원' }];
    const out = await retrieveRuleChunks('의욕관리비 한도', {
      functionsUrl: 'https://x.functions.supabase.co',
      anonKey: 'anon',
      fetchImpl: ok(chunks),
    });
    expect(out).toEqual(chunks);
  });

  it('빈 결과면 null(폴백 신호)', async () => {
    const out = await retrieveRuleChunks('q', {
      functionsUrl: 'https://x', anonKey: 'a', fetchImpl: ok([]),
    });
    expect(out).toBeNull();
  });

  it('HTTP 오류/예외면 null(폴백 신호)', async () => {
    const boom = vi.fn(async () => { throw new Error('network'); });
    const out = await retrieveRuleChunks('q', { functionsUrl: 'https://x', anonKey: 'a', fetchImpl: boom });
    expect(out).toBeNull();
  });
});

describe('knowledgeFromChunks', () => {
  it('문서·헤딩 표기를 포함해 문자열로 만든다', () => {
    const s = knowledgeFromChunks([{ doc: 'team.md', heading: '예산 > 의욕관리비', content: '한도 30만원' }]);
    expect(s).toContain('team.md');
    expect(s).toContain('예산 > 의욕관리비');
    expect(s).toContain('한도 30만원');
  });
});
```

- [ ] **Step 2: 실패 확인**
Run: `npx vitest run lib/counsel/retrieve.test.ts` → FAIL (module 없음).

- [ ] **Step 3: 최소 구현**

`lib/counsel/retrieve.js`:
```js
// 룰 RAG 검색 이음새(서버측). api/chat.ts 가 Supabase Edge Function 'rag-search' 를 호출한다.
// 실패·빈결과·미설정은 모두 null 을 돌려 호출부가 '전체주입 폴백'으로 안전하게 되돌아가게 한다.

/**
 * @param {string} query
 * @param {{functionsUrl:string, anonKey:string, matchCount?:number, fetchImpl?:typeof fetch}} opts
 * @returns {Promise<Array<{doc:string,heading:string,content:string}>|null>}
 */
export async function retrieveRuleChunks(query, opts) {
  const { functionsUrl, anonKey, matchCount = 20, fetchImpl = fetch } = opts || {};
  if (!functionsUrl || !anonKey || !query) return null;
  try {
    const res = await fetchImpl(`${functionsUrl.replace(/\/$/, '')}/rag-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ query, matchCount }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const chunks = data && data.ok && Array.isArray(data.chunks) ? data.chunks : null;
    return chunks && chunks.length ? chunks : null;
  } catch {
    return null;
  }
}

/**
 * @param {Array<{doc:string,heading:string,content:string}>} chunks
 * @returns {string}
 */
export function knowledgeFromChunks(chunks) {
  return (chunks || [])
    .map((c) => `\n\n===== ${c.doc} · ${c.heading} =====\n${c.content}`)
    .join('\n');
}
```

- [ ] **Step 4: 통과 확인**
Run: `npx vitest run lib/counsel/retrieve.test.ts` → PASS (4 tests).

- [ ] **Step 5: 커밋**
```bash
git add lib/counsel/retrieve.js lib/counsel/retrieve.test.ts
git commit -m "feat(counsel): 룰 RAG retrieve 이음새 + 폴백(null) + knowledge 포맷"
```

---

### Task 3: DB 마이그레이션 (pgvector + rule_chunks + RPC)

**Files:**
- Create: `supabase/migrations/20260817000000_rule_rag.sql`

**Note:** 실제 적용(`supabase db push`)은 Task 7(배포, 사용자 login 후). 이 태스크는 파일 작성·검토만.

- [ ] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/20260817000000_rule_rag.sql`:
```sql
-- 룰 RAG: 벡터 검색용 확장·테이블·인덱스·검색 RPC.
create extension if not exists vector;

create table if not exists public.rule_chunks (
  id uuid primary key default gen_random_uuid(),
  doc text not null,
  heading text not null,
  content text not null,
  embedding vector(384),
  updated_at timestamptz not null default now()
);

-- HNSW 코사인 인덱스(소규모 코퍼스에 충분).
create index if not exists rule_chunks_embedding_idx
  on public.rule_chunks using hnsw (embedding vector_cosine_ops);

-- 최소권한: 테이블 직접 접근 차단(anon/authenticated). 검색은 아래 RPC(SECURITY DEFINER)로만.
alter table public.rule_chunks enable row level security;
-- (RLS 정책 미부여 = 기본 거부. Edge Function 은 service_role 로 RPC 를 통해 접근.)

-- 코사인 유사도 상위 match_count 청크 반환.
create or replace function public.match_rule_chunks(
  query_embedding vector(384),
  match_count int default 20
)
returns table (doc text, heading text, content text, similarity float)
language sql stable
security definer
set search_path = public
as $$
  select rc.doc, rc.heading, rc.content,
         1 - (rc.embedding <=> query_embedding) as similarity
  from public.rule_chunks rc
  where rc.embedding is not null
  order by rc.embedding <=> query_embedding
  limit greatest(1, match_count);
$$;

-- Edge Function(service_role)이 호출. anon 직접 실행은 불필요하므로 부여하지 않는다.
grant execute on function public.match_rule_chunks(vector, int) to service_role;
```

- [ ] **Step 2: SQL 자체 검토(수동)**

파일을 다시 읽어 확인: 확장·테이블·인덱스·RPC 시그니처(`vector(384)`, `match_count int`), SECURITY DEFINER + search_path 고정, service_role grant. 문법 오류·오탈자 없음. (실제 적용은 Task 7에서 `supabase db push`로 검증.)

- [ ] **Step 3: 커밋**
```bash
git add supabase/migrations/20260817000000_rule_rag.sql
git commit -m "feat(counsel): 룰 RAG 마이그레이션(pgvector·rule_chunks·match_rule_chunks RPC)"
```

---

### Task 4: Edge Function `rag-search` (쿼리)

**Files:**
- Create: `supabase/functions/rag-search/index.ts`

**Note:** Deno 함수 — vitest 대상 아님. 배포 후 Task 7에서 통합 검증. **구현 전 Supabase 내장 임베딩 API 표면을 현재 문서로 확인**(supabase 스킬/Context7): `Supabase.ai.Session('gte-small')` 및 `.run(text, { mean_pool:true, normalize:true })`가 현재 시그니처인지.

**Interfaces:**
- 입력 JSON: `{ query: string, matchCount?: number }`
- 출력 JSON: `{ ok:true, chunks:[{doc,heading,content}] }` | `{ ok:false, reason }`

- [ ] **Step 1: 구현 작성**

`supabase/functions/rag-search/index.ts`:
```ts
// 룰 RAG 쿼리 함수: gte-small 로 질문을 임베딩하고 match_rule_chunks RPC 로 top-k 청크를 돌려준다.
// 호출자는 Vercel 함수(api/chat.ts)이며 anon 키를 Bearer 로 전달한다(verify_jwt 기본값 사용).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const model = new Supabase.ai.Session('gte-small');

Deno.serve(async (req) => {
  try {
    const { query, matchCount = 20 } = await req.json();
    if (!query || typeof query !== 'string') {
      return Response.json({ ok: false, reason: 'query required' }, { status: 400 });
    }
    // 384차원 임베딩. 문서 색인(reindex-rules)과 동일 옵션이어야 벡터가 호환된다.
    const embedding = await model.run(query, { mean_pool: true, normalize: true });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data, error } = await supabase.rpc('match_rule_chunks', {
      query_embedding: embedding,
      match_count: matchCount,
    });
    if (error) return Response.json({ ok: false, reason: error.message });
    const chunks = (data ?? []).map((r: { doc: string; heading: string; content: string }) => ({
      doc: r.doc, heading: r.heading, content: r.content,
    }));
    return Response.json({ ok: true, chunks });
  } catch (e) {
    return Response.json({ ok: false, reason: String(e) });
  }
});
```

- [ ] **Step 2: 로컬 문법 확인(선택)**

가능하면 `deno check supabase/functions/rag-search/index.ts` (deno 있으면). 없으면 스킵 — 배포(Task 7)에서 검증.

- [ ] **Step 3: 커밋**
```bash
git add supabase/functions/rag-search/index.ts
git commit -m "feat(counsel): rag-search Edge Function(gte-small 임베딩+벡터검색)"
```

---

### Task 5: Edge Function `reindex-rules` + 시드 스크립트

**Files:**
- Create: `supabase/functions/reindex-rules/index.ts`
- Create: `scripts/seed-rule-chunks.mjs`

**Note:** Deno 함수 + Node 스크립트. 실제 시드는 Task 7. 여기선 작성.

**Interfaces (reindex-rules):**
- 입력 JSON: `{ chunks: Array<{doc,heading,content}> }`
- 동작: 각 청크 gte-small 임베딩 → `delete from rule_chunks` → `insert`. 출력 `{ ok:true, inserted:N }`.

- [ ] **Step 1: reindex-rules 작성**

`supabase/functions/reindex-rules/index.ts`:
```ts
// 룰 청크 재색인: 요청 본문의 청크들을 gte-small 로 임베딩해 rule_chunks 를 통째로 교체한다.
// 서비스롤 컨텍스트로 실행(쓰기). 호출: supabase functions invoke reindex-rules --body @chunks.json
import { createClient } from 'jsr:@supabase/supabase-js@2';

const model = new Supabase.ai.Session('gte-small');

Deno.serve(async (req) => {
  try {
    const { chunks } = await req.json();
    if (!Array.isArray(chunks) || chunks.length === 0) {
      return Response.json({ ok: false, reason: 'chunks required' }, { status: 400 });
    }
    const rows = [];
    for (const c of chunks) {
      const embedding = await model.run(c.content, { mean_pool: true, normalize: true });
      rows.push({ doc: c.doc, heading: c.heading, content: c.content, embedding });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const del = await supabase.from('rule_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (del.error) return Response.json({ ok: false, reason: del.error.message });
    const ins = await supabase.from('rule_chunks').insert(rows);
    if (ins.error) return Response.json({ ok: false, reason: ins.error.message });
    return Response.json({ ok: true, inserted: rows.length });
  } catch (e) {
    return Response.json({ ok: false, reason: String(e) });
  }
});
```

- [ ] **Step 2: 시드 스크립트 작성**

`scripts/seed-rule-chunks.mjs`:
```js
// 로컬 src/content/*.md 를 청킹해 reindex-rules Edge Function 으로 보내 색인한다.
// 사용: supabase link 후 →  node scripts/seed-rule-chunks.mjs
//   내부적으로 chunks.json 을 만들고 `supabase functions invoke reindex-rules --body @chunks.json` 를 실행한다.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chunkMarkdown } from '../supabase/functions/_shared/chunk.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(HERE, '..', 'src', 'content');

const chunks = [];
for (const f of readdirSync(CONTENT).filter((f) => f.endsWith('.md')).sort()) {
  const md = readFileSync(join(CONTENT, f), 'utf8');
  chunks.push(...chunkMarkdown(md, f));
}
if (chunks.length === 0) {
  console.error('청크가 없습니다. src/content/*.md 확인.');
  process.exit(1);
}
const out = join(HERE, '..', 'chunks.json');
writeFileSync(out, JSON.stringify({ chunks }));
console.log(`청크 ${chunks.length}개 → ${out}. reindex-rules 호출...`);
execFileSync('supabase', ['functions', 'invoke', 'reindex-rules', '--body', `@${out}`], { stdio: 'inherit' });
console.log('완료.');
```

- [ ] **Step 3: 시드 스크립트 청킹 부분 스모크(임베딩/네트워크 없이)**

`chunkMarkdown` 임포트 경로가 맞는지, 청크가 생성되는지 확인용으로 아래를 임시 실행(파일 생성만, invoke 전 Ctrl-C 가능):
Run: `node -e "import('./supabase/functions/_shared/chunk.js').then(async m => { const {readFileSync,readdirSync}=await import('node:fs'); let n=0; for(const f of readdirSync('src/content').filter(x=>x.endsWith('.md'))){n+=m.chunkMarkdown(readFileSync('src/content/'+f,'utf8'),f).length;} console.log('chunks:',n); })"`
Expected: `chunks: <100~180 사이 숫자>` (대략 헤딩 수 규모). 0이면 청킹/경로 문제.

- [ ] **Step 4: 커밋**
```bash
git add supabase/functions/reindex-rules/index.ts scripts/seed-rule-chunks.mjs
git commit -m "feat(counsel): reindex-rules Edge Function + 로컬 md 시드 스크립트"
```

---

### Task 6: api/chat.ts 룰 모드 배선

**Files:**
- Modify: `api/chat.ts`

**Interfaces:**
- Consumes: `retrieveRuleChunks`, `knowledgeFromChunks`(Task 2), `buildSystemContent`(Phase 1a).

- [ ] **Step 1: import 추가**

`api/chat.ts` 상단 import 블록에 추가:
```ts
import { retrieveRuleChunks, knowledgeFromChunks } from '../lib/counsel/retrieve.js';
```

- [ ] **Step 2: 룰 모드에서 RAG 적용(폴백 포함)**

`POST` 핸들러에서 위기 단락 이후, `buildMessages(body)`로 시스템 프롬프트를 만들기 전에 삽입. 룰 모드 + SUPABASE env 있을 때만 검색하고, 실패 시 body 를 그대로 둔다(전체주입 폴백):
```ts
  // 룰 모드: 관련 룰 청크만 의미검색으로 주입(Phase 1b). 실패/미설정이면 body.knowledge(전체) 폴백.
  let effectiveBody = body;
  if (body.mode === 'rule') {
    const supabaseUrl = env('SUPABASE_URL');
    const anonKey = env('SUPABASE_ANON_KEY');
    if (supabaseUrl && anonKey && lastUser) {
      const functionsUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');
      const chunks = await retrieveRuleChunks(lastUser, { functionsUrl, anonKey });
      if (chunks) effectiveBody = { ...body, knowledge: knowledgeFromChunks(chunks) };
    }
  }
```
그리고 아래의 `buildMessages(body)` 호출을 `buildMessages(effectiveBody)`로 바꾼다. (`lastUser`는 위기 단락에서 이미 계산됨 — 그 값을 재사용. 없으면 이 블록 위에서 동일 식으로 계산.)

- [ ] **Step 3: 전체 테스트 회귀 확인**

Run: `npx vitest run`
Expected: PASS — 기존 + Task 1·2 신규 테스트 통과(회귀 없음). api/chat.ts 자체 유닛테스트는 없음(retrieve/chunk 가 단위 커버).

- [ ] **Step 4: 커밋**
```bash
git add api/chat.ts
git commit -m "feat(counsel): api/chat.ts 룰 모드 RAG 배선(retrieve→청크 주입, 전체주입 폴백)"
```

---

### Task 7: 배포·시드·검증 (사용자 `supabase login` 후)

**전제:** 사용자가 `supabase login` + `supabase link --project-ref sjymcpjbmsqapsptvlml` 완료.
**Note:** 이 태스크는 인프라 부수효과(마이그레이션 push·함수 배포·시드·prod env)를 포함 — 컨트롤러가 사용자 확인 하에 실행. Vercel env 는 사용자 몫.

- [ ] **Step 1: supabase/ 초기화 확인**
`supabase/config.toml`이 없으면 `supabase init`(migrations/functions 는 이미 생성됨 — 덮어쓰지 말 것).

- [ ] **Step 2: 마이그레이션 적용**
Run: `supabase db push`
Expected: `20260817000000_rule_rag.sql` 적용, 오류 없음. (pgvector 확장 생성, rule_chunks, RPC.)

- [ ] **Step 3: Edge Function 배포**
Run: `supabase functions deploy rag-search reindex-rules`
Expected: 두 함수 배포 성공. 실패 시 Supabase.ai gte-small 지원/문법 확인.

- [ ] **Step 4: 시드**
Run: `node scripts/seed-rule-chunks.mjs`
Expected: `청크 N개 … inserted:N`. Supabase 대시보드에서 rule_chunks 행 수·embedding non-null 확인.

- [ ] **Step 5: rag-search 스모크**
Run(프로젝트 ref·anon 키로):
`supabase functions invoke rag-search --body '{"query":"의욕관리비 한도 얼마야","matchCount":5}'`
Expected: `{ok:true, chunks:[…]}` 에 예산/의욕관리비 관련 청크가 상위에 포함.

- [ ] **Step 6: Vercel env (사용자)**
사용자: Vercel Production env `SUPABASE_URL`, `SUPABASE_ANON_KEY` 설정(프론트 VITE_SUPABASE_* 와 동일 값). 없으면 api/chat.ts 는 전체주입 폴백으로 계속 동작.

- [ ] **Step 7: 배포 검증**
dev push → 웹 배포 후 룰 질문 2~3건(예산·하이닉스 출입)으로 관련 답변·출처가 나오는지, 폴백(env 제거 시)도 정상인지 확인.

---

## Self-Review

**Spec coverage:** pgvector+rule_chunks+RPC(T3) ✓, rag-search(T4) ✓, reindex-rules+seed(T5) ✓, 청킹(T1) ✓, retrieve+폴백(T2,T6) ✓, api 배선(T6) ✓, 배포 런북(T7) ✓, 고회수율 match_count=20(T2 default, T3 RPC default) ✓, 전체주입 폴백(T2 null→T6) ✓.

**Placeholder scan:** Supabase.ai API 표면은 T4 Step에서 현재 문서로 확인하도록 명시(알려진 검증 지점, 모호지시 아님). 마이그레이션 타임스탬프는 고정 파일명. TBD 없음.

**Type/이름 일관성:** `chunkMarkdown(md,doc)`(T1)→seed(T5)에서 동일 호출. `retrieveRuleChunks`/`knowledgeFromChunks`(T2)→api(T6) 동일. `match_rule_chunks(query_embedding,match_count)`(T3 RPC)→rag-search(T4 rpc 호출) 시그니처 일치. Edge Function 출력 `{ok,chunks}`↔retrieve 파싱 일치.

## 후속

- Phase 2(상담 사례 RAG): 같은 인프라에 `case_embeddings` 테이블 + reindex(동적) + rag-search 에 mode 분기 추가. 이 Phase 1b 가 인프라 검증대.
