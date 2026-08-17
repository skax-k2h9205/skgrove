# 오은영AI Phase 2 — 상담 사례 RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상담 모드의 유사사례를 클라 키워드 검색에서 서버 pgvector 의미검색(case_embeddings)으로 교체하고, 이슈/안건 변경 시 DB 트리거(pg_net)가 행 단위로 준실시간 색인한다. 실패·미설정 시 클라가 보낸 cases로 폴백.

**Architecture:** 1b 인프라 패턴 재사용 — gte-small Edge 임베딩(행당 1회=한도 안전), x-reindex-secret, RPC 권한 revoke, null 폴백+5s 타임아웃. 신규는 pg_net 트리거+Vault(URL·시크릿 보관)뿐. 정책(리더만보기 제외·암호글 제목만)은 순수함수 `caseContentOf`로 분리해 vitest 검증.

**Tech Stack:** Supabase(pgvector·pg_net·Vault·Edge/Deno), ESM `.js` 공유 모듈, vitest, Vercel 서버리스.

**Spec:** `docs/superpowers/specs/2026-08-17-oeunyoung-ai-phase2-case-rag-design.md`

## Global Constraints

- 위기 단락·룰 RAG 경로·비스트리밍 JSON·maxDuration=60 **불변**(회귀 금지).
- 임베딩은 요청당 1개(Edge WORKER_RESOURCE_LIMIT 실측). 쿼리·문서 동일 옵션 `{mean_pool:true, normalize:true}`.
- 색인 정책: issue는 `visibility === '안건 후보로 공개 가능'`만(그 외·null은 제외=색인 삭제), `encrypted`면 제목·카테고리·상태만. agenda는 전체. content 1200자 캡, snippet 80자.
- 상담 검색 실패/빈결과/타임아웃/env·tenantId 없음 → **클라 전송 cases 폴백**.
- 쓰기(reindex-cases)는 `x-reindex-secret` fail-closed 401. `match_case_chunks`는 PUBLIC/anon/authenticated revoke.
- 기존 마이그레이션 파일 수정 금지(새 파일만). Vault 시크릿은 마이그레이션에 넣지 않는다(런북 SQL).
- 순수 ESM `.js`, import 확장자 명시(Deno·vitest 겸용).

---

## File Structure

- Create: `supabase/functions/_shared/caseContent.js` + `caseContent.test.ts` — 색인 정책 순수함수.
- Modify: `lib/counsel/retrieve.js` + `retrieve.test.ts` — `retrieveCases` 추가.
- Create: `supabase/migrations/20260817200000_case_rag.sql` — pg_net·case_embeddings·RPC·트리거.
- Create: `supabase/functions/reindex-cases/index.ts` — 행 1건 색인/삭제.
- Modify: `supabase/functions/rag-search/index.ts` — `scope:'cases'`+`tenantId`, countOnly에 scope.
- Create: `scripts/backfill-case-embeddings.mjs` — 기존 데이터 백필(행당 1 POST·재시도·검증).
- Modify: `api/chat.ts`(상담 배선+ChatBody.tenantId), `src/aiChat.ts`(ChatRequest.tenantId), `src/features/chat/ChatWidget.tsx`(tenantId 전달).

---

### Task 1: 색인 정책 순수함수 (`supabase/functions/_shared/caseContent.js`)

**Files:** Create 위 2개.
**Interfaces:** Produces `caseContentOf(source:'issue'|'agenda', row): {title,status,snippet,content} | null` (null=색인 제외).

- [ ] **Step 1: 실패하는 테스트**

`supabase/functions/_shared/caseContent.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { caseContentOf } from './caseContent.js';

describe('caseContentOf', () => {
  it('공개 가능 평문 이슈는 본문·기대변화까지 content 에 넣는다', () => {
    const out = caseContentOf('issue', {
      title: '회의 발언 기회', visibility: '안건 후보로 공개 가능', encrypted: false,
      body: '회의에서 말할 틈이 없어요', expected_change: '라운드로빈 발언', status: '검토중', category: '문화',
    });
    expect(out).toBeTruthy();
    expect(out!.content).toContain('말할 틈');
    expect(out!.content).toContain('라운드로빈');
    expect(out!.snippet).toContain('말할 틈');
  });

  it('리더만 보기(또는 visibility 누락) 이슈는 제외(null)', () => {
    expect(caseContentOf('issue', { title: 'x', visibility: '리더만 보기', body: 'b', status: 's' })).toBeNull();
    expect(caseContentOf('issue', { title: 'x', body: 'b', status: 's' })).toBeNull();
  });

  it('암호화 이슈는 제목·카테고리·상태만 (본문 미포함)', () => {
    const out = caseContentOf('issue', {
      title: '팀장님과의 갈등', visibility: '안건 후보로 공개 가능', encrypted: true,
      body: '', expected_change: '', status: '접수', category: '관계',
    });
    expect(out).toBeTruthy();
    expect(out!.content).toContain('팀장님과의 갈등');
    expect(out!.content).toContain('관계');
    expect(out!.snippet).toBe('팀장님과의 갈등');
  });

  it('안건은 제목+설명, 1200자 캡·80자 스니펫', () => {
    const long = '가'.repeat(3000);
    const out = caseContentOf('agenda', { title: '재택 규칙', description: long, status: '투표중' });
    expect(out).toBeTruthy();
    expect(out!.content.length).toBeLessThanOrEqual(1200);
    expect(out!.snippet.length).toBeLessThanOrEqual(81); // 80 + '…'
  });

  it('제목 없음·미지 source 는 null', () => {
    expect(caseContentOf('agenda', { title: '', description: 'd', status: 's' })).toBeNull();
    expect(caseContentOf('memo' as never, { title: 't' })).toBeNull();
  });
});
```

- [ ] **Step 2: RED 확인** — `npx vitest run supabase/functions/_shared/caseContent.test.ts` → 모듈 없음 FAIL.

- [ ] **Step 3: 구현**

`supabase/functions/_shared/caseContent.js`:
```js
// 상담 사례 색인 정책(순수). reindex-cases(Deno)와 vitest 가 함께 쓴다.
// 프라이버시 경계가 이 함수 하나에 모인다: '리더만 보기'는 색인하지 않고(null),
// E2E 암호글은 서버가 본문을 읽을 수 없으므로 제목·카테고리·상태만 넣는다.
const CAP = 1200;

function snip(text, n = 80) {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/**
 * @param {'issue'|'agenda'} source
 * @param {Record<string, unknown>} row  DB 행(snake_case)
 * @returns {{title:string,status:string,snippet:string,content:string}|null} null=색인 제외
 */
export function caseContentOf(source, row) {
  if (!row || typeof row !== 'object') return null;
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (!title) return null;
  const status = typeof row.status === 'string' ? row.status : '';

  if (source === 'issue') {
    if (row.visibility !== '안건 후보로 공개 가능') return null;
    if (row.encrypted) {
      const content = [title, row.category, status].filter(Boolean).join('\n').slice(0, CAP);
      return { title, status, snippet: snip(title), content };
    }
    const body = typeof row.body === 'string' ? row.body : '';
    const expected = typeof row.expected_change === 'string' ? row.expected_change : '';
    const content = [title, body, expected].filter(Boolean).join('\n').slice(0, CAP);
    return { title, status, snippet: snip(body || expected || title), content };
  }

  if (source === 'agenda') {
    const desc = typeof row.description === 'string' ? row.description : '';
    const content = [title, desc].filter(Boolean).join('\n').slice(0, CAP);
    return { title, status, snippet: snip(desc || title), content };
  }

  return null;
}
```

- [ ] **Step 4: GREEN 확인** — 같은 명령 PASS (5 tests).
- [ ] **Step 5: 커밋** — `feat(counsel): 사례 색인 정책 순수함수(리더만보기 제외·암호글 제목만)`

---

### Task 2: `retrieveCases` (`lib/counsel/retrieve.js` 확장)

**Files:** Modify `lib/counsel/retrieve.js`, `lib/counsel/retrieve.test.ts`.
**Interfaces:** Produces `retrieveCases(query, {functionsUrl, anonKey, tenantId, matchCount=6, timeoutMs=5000, fetchImpl}) → CaseBrief[]|null`. CaseBrief = `{source:'대나무숲'|'안건', id, title, status, snippet}`.

- [ ] **Step 1: 실패하는 테스트 추가** (기존 파일에 describe 추가)

```ts
import { retrieveCases } from './retrieve.js'; // 상단 import 에 추가

describe('retrieveCases', () => {
  const okCases = (chunks: unknown) =>
    vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, chunks }) }) as unknown as Response);

  it('성공 시 CaseBrief 로 변환한다(issue→대나무숲, agenda→안건)', async () => {
    const rows = [
      { source: 'issue', refId: 'SOOP-1', title: '회의 갈등', status: '검토중', snippet: '요약' },
      { source: 'agenda', refId: 'AG-2', title: '재택 규칙', status: '투표중', snippet: '설명' },
    ];
    const out = await retrieveCases('회의에서 힘들어요', {
      functionsUrl: 'https://x', anonKey: 'a', tenantId: 'T1', fetchImpl: okCases(rows),
    });
    expect(out).toEqual([
      { source: '대나무숲', id: 'SOOP-1', title: '회의 갈등', status: '검토중', snippet: '요약' },
      { source: '안건', id: 'AG-2', title: '재택 규칙', status: '투표중', snippet: '설명' },
    ]);
  });

  it('요청 body 에 scope:cases·tenantId·기본 matchCount 6 이 실린다', async () => {
    const f = okCases([{ source: 'issue', refId: 'S', title: 't', status: 's', snippet: 'n' }]);
    await retrieveCases('q', { functionsUrl: 'https://x', anonKey: 'a', tenantId: 'T1', fetchImpl: f });
    const init = f.mock.calls[0][1] as { body: string };
    const sent = JSON.parse(init.body);
    expect(sent.scope).toBe('cases');
    expect(sent.tenantId).toBe('T1');
    expect(sent.matchCount).toBe(6);
  });

  it('빈 결과·오류·env 누락은 null(폴백 신호)', async () => {
    expect(await retrieveCases('q', { functionsUrl: 'https://x', anonKey: 'a', tenantId: 'T1', fetchImpl: okCases([]) })).toBeNull();
    const boom = vi.fn(async () => { throw new Error('net'); });
    expect(await retrieveCases('q', { functionsUrl: 'https://x', anonKey: 'a', tenantId: 'T1', fetchImpl: boom })).toBeNull();
    expect(await retrieveCases('q', { functionsUrl: '', anonKey: 'a', tenantId: 'T1' })).toBeNull();
  });
});
```
두 번째 테스트의 body 파싱은 기존 `matchCount` 테스트(룰)와 같은 방식으로 작성한다: `f.mock.calls[0][1].body` 를 JSON.parse 해 `scope==='cases'`, `tenantId==='T1'`, `matchCount===6` 단언. (기존 파일의 룰용 body 단언 테스트 스타일을 그대로 따를 것.)

- [ ] **Step 2: RED 확인** — export 없음 FAIL.
- [ ] **Step 3: 구현** (`retrieve.js`에 추가)

```js
/**
 * 상담 유사사례 의미검색. 실패·빈결과·설정누락은 null(호출부가 클라 cases 로 폴백).
 * @param {string} query
 * @param {{functionsUrl:string, anonKey:string, tenantId?:string|null, matchCount?:number,
 *   timeoutMs?:number, fetchImpl?:typeof fetch}} opts
 * @returns {Promise<Array<{source:string,id:string,title:string,status:string,snippet:string}>|null>}
 */
export async function retrieveCases(query, opts) {
  const { functionsUrl, anonKey, tenantId = null, matchCount = 6, timeoutMs = 5000, fetchImpl = fetch } = opts || {};
  if (!functionsUrl || !anonKey || !query) return null;
  try {
    const res = await fetchImpl(`${functionsUrl.replace(/\/$/, '')}/rag-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ scope: 'cases', query, tenantId, matchCount }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const rows = data && data.ok && Array.isArray(data.chunks) ? data.chunks : null;
    if (!rows || rows.length === 0) return null;
    return rows.map((r) => ({
      source: r.source === 'issue' ? '대나무숲' : '안건',
      id: String(r.refId ?? ''),
      title: String(r.title ?? ''),
      status: String(r.status ?? ''),
      snippet: String(r.snippet ?? ''),
    }));
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: GREEN + 전체 회귀** — `npx vitest run` (488 + 신규).
- [ ] **Step 5: 커밋** — `feat(counsel): retrieveCases — 사례 의미검색 이음새(+CaseBrief 변환·폴백)`

---

### Task 3: 마이그레이션 (`supabase/migrations/20260817200000_case_rag.sql`)

**Files:** Create 1개. 적용은 T7.
**Interfaces:** RPC `match_case_chunks(query_embedding vector(384), p_tenant text, match_count int default 6)` — T4 rag-search가 이 이름·파라미터로 호출.

- [ ] **Step 1: SQL 작성**

```sql
-- 상담 사례 RAG: 색인 테이블·검색 RPC·행 단위 준실시간 색인 트리거(pg_net→Edge).
create extension if not exists pg_net;

create table if not exists public.case_embeddings (
  source text not null check (source in ('issue','agenda')),
  ref_id text not null,
  tenant_id text,
  title text not null,
  status text not null default '',
  snippet text not null default '',
  content text not null,
  embedding vector(384),
  updated_at timestamptz not null default now(),
  primary key (source, ref_id)
);

create index if not exists case_embeddings_embedding_idx
  on public.case_embeddings using hnsw (embedding vector_cosine_ops);

alter table public.case_embeddings enable row level security; -- 정책 없음 = 전면 거부

create or replace function public.match_case_chunks(
  query_embedding vector(384),
  p_tenant text,
  match_count int default 6
)
returns table (source text, ref_id text, title text, status text, snippet text, similarity float)
language sql stable
security definer
set search_path = public
as $$
  select ce.source, ce.ref_id, ce.title, ce.status, ce.snippet,
         1 - (ce.embedding <=> query_embedding) as similarity
  from public.case_embeddings ce
  where ce.embedding is not null
    and ce.tenant_id is not distinct from p_tenant
  order by ce.embedding <=> query_embedding
  limit greatest(1, match_count);
$$;

revoke execute on function public.match_case_chunks(vector, text, int) from public;
revoke execute on function public.match_case_chunks(vector, text, int) from anon;
revoke execute on function public.match_case_chunks(vector, text, int) from authenticated;
grant execute on function public.match_case_chunks(vector, text, int) to service_role;

-- 행 변경 → Edge reindex-cases 에 1건 POST. Vault 미시드면 조용히 건너뜀(색인만 지연, 비차단).
create or replace function public.notify_case_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text; v_secret text; v_anon text;
  v_source text := case when tg_table_name = 'issues' then 'issue' else 'agenda' end;
  v_ref text;
begin
  v_ref := coalesce(new.id, old.id);
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'counsel_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'counsel_reindex_secret';
  select decrypted_secret into v_anon from vault.decrypted_secrets where name = 'counsel_anon_key';
  if v_url is null or v_secret is null or v_anon is null then
    return coalesce(new, old);
  end if;
  perform net.http_post(
    url := v_url || '/reindex-cases',
    body := jsonb_build_object('source', v_source, 'refId', v_ref),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-reindex-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists issues_case_embed on public.issues;
create trigger issues_case_embed
  after insert or update or delete on public.issues
  for each row execute function public.notify_case_change();

drop trigger if exists agendas_case_embed on public.agendas;
create trigger agendas_case_embed
  after insert or update or delete on public.agendas
  for each row execute function public.notify_case_change();
```

- [ ] **Step 2: 자체 검토** — RPC 시그니처(T4와 일치), revoke 3종, RLS, 트리거 delete 경로(old.id), Vault 3키 이름. 
- [ ] **Step 3: 커밋** — `feat(counsel): 사례 RAG 마이그레이션(case_embeddings·match_case_chunks·pg_net 트리거)`

---

### Task 4: Edge Functions — `reindex-cases` 신규 + `rag-search` 확장

**Files:** Create `supabase/functions/reindex-cases/index.ts`, Modify `supabase/functions/rag-search/index.ts`.
**Interfaces:** reindex-cases 입력 `{source,refId}`, 출력 `{ok, action:'upserted'|'excluded'|'deleted'}`. rag-search 입력에 `scope?, tenantId?` — cases면 `{ok, chunks:[{source,refId,title,status,snippet}]}`, countOnly+scope:'cases'는 case_embeddings 카운트.

- [ ] **Step 1: reindex-cases 작성**

```ts
// 사례 1건 색인/삭제. 트리거(pg_net)·백필 스크립트가 행 단위로 부른다(요청당 임베딩 1회 = Edge 한도 안전).
// 정책은 _shared/caseContent.js 단일 출처 — '리더만 보기' 제외, 암호글 제목만.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { caseContentOf } from '../_shared/caseContent.js';

const model = new Supabase.ai.Session('gte-small');

Deno.serve(async (req) => {
  const secret = Deno.env.get('REINDEX_SECRET');
  if (!secret || req.headers.get('x-reindex-secret') !== secret) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  try {
    const { source, refId } = await req.json();
    if ((source !== 'issue' && source !== 'agenda') || !refId) {
      return Response.json({ ok: false, reason: 'source/refId required' }, { status: 400 });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const table = source === 'issue' ? 'issues' : 'agendas';
    const { data: row, error } = await supabase.from(table).select('*').eq('id', refId).maybeSingle();
    if (error) return Response.json({ ok: false, reason: error.message });

    const policy = row ? caseContentOf(source, row) : null;
    if (!policy) {
      // 행이 없거나(삭제) 정책상 제외 — 색인에서 지운다.
      const del = await supabase.from('case_embeddings').delete().eq('source', source).eq('ref_id', refId);
      if (del.error) return Response.json({ ok: false, reason: del.error.message });
      return Response.json({ ok: true, action: row ? 'excluded' : 'deleted' });
    }

    const embedding = await model.run(policy.content, { mean_pool: true, normalize: true });
    const up = await supabase.from('case_embeddings').upsert({
      source, ref_id: refId,
      tenant_id: (row as { tenant_id?: string | null }).tenant_id ?? null,
      title: policy.title, status: policy.status, snippet: policy.snippet, content: policy.content,
      embedding, updated_at: new Date().toISOString(),
    });
    if (up.error) return Response.json({ ok: false, reason: up.error.message });
    return Response.json({ ok: true, action: 'upserted' });
  } catch (e) {
    return Response.json({ ok: false, reason: String(e) });
  }
});
```

- [ ] **Step 2: rag-search 확장** — 기존 rules 경로·countOnly 회귀 없이:
  - parse 를 `const { query, matchCount, countOnly = false, scope = 'rules', tenantId = null } = await req.json();` 로. matchCount 기본은 scope 별로: `const k = matchCount ?? (scope === 'cases' ? 6 : 20);`
  - countOnly: `const table = scope === 'cases' ? 'case_embeddings' : 'rule_chunks';` 로 기존 로직 일반화.
  - scope==='cases' 검색: 쿼리 임베딩(동일 옵션) 후 `supabase.rpc('match_case_chunks', { query_embedding: embedding, p_tenant: tenantId, match_count: k })` → `chunks = data.map(r => ({source:r.source, refId:r.ref_id, title:r.title, status:r.status, snippet:r.snippet}))`.
  - scope==='rules' 는 기존 그대로(`match_rule_chunks`, doc/heading/content 반환).

- [ ] **Step 3: 문법 확인(가능하면)** — `deno check` 없으면 스킵(T7 배포가 검증).
- [ ] **Step 4: 커밋** — `feat(counsel): reindex-cases + rag-search scope=cases(테넌트 필터·countOnly 일반화)`

---

### Task 5: 백필 스크립트 (`scripts/backfill-case-embeddings.mjs`)

**Files:** Create 1개.
**Interfaces:** Consumes reindex-cases(T4)·rag-search countOnly(T4). 1b seed 스크립트의 env 로딩·재시도 패턴을 따른다.

- [ ] **Step 1: 작성**

```js
// 기존 issues/agendas 를 case_embeddings 로 백필한다. 행당 1 POST(Edge 임베딩 한도).
// id 목록은 REST(anon)로 읽고, 색인은 reindex-cases(비밀헤더)가 정책 적용까지 수행한다.
// 사용: node scripts/backfill-case-embeddings.mjs   (env: 1b seed 와 동일 + REINDEX_SECRET)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

function envFromFile(file, key) {
  try {
    const text = readFileSync(join(ROOT, file), 'utf8');
    const m = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`, 'm'));
    return m ? m[1].replace(/^["']|["']$/g, '') : undefined;
  } catch { return undefined; }
}

const SUPABASE_URL = process.env.SUPABASE_URL || envFromFile('.env.demo.local', 'VITE_SUPABASE_URL') || envFromFile('.env.ios.local', 'VITE_SUPABASE_URL');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || envFromFile('.env.demo.local', 'VITE_SUPABASE_ANON_KEY') || envFromFile('.env.ios.local', 'VITE_SUPABASE_ANON_KEY');
const REINDEX_SECRET = process.env.REINDEX_SECRET || envFromFile('.env.supabase.local', 'REINDEX_SECRET');
if (!SUPABASE_URL || !ANON_KEY || !REINDEX_SECRET) {
  console.error('SUPABASE_URL / SUPABASE_ANON_KEY / REINDEX_SECRET 필요(.env.demo.local·.env.supabase.local).');
  process.exit(1);
}
const BASE = SUPABASE_URL.replace(/\/$/, '');

async function listIds(table) {
  const res = await fetch(`${BASE}/rest/v1/${table}?select=id`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) { console.error(`${table} 목록 실패 HTTP ${res.status}`); process.exit(1); }
  return (await res.json()).map((r) => r.id);
}

const RETRY_MS = [1000, 3000];
async function reindexOne(source, refId) {
  let lastErr;
  for (let a = 0; a < 1 + RETRY_MS.length; a++) {
    try {
      const res = await fetch(`${BASE}/functions/v1/reindex-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}`, 'x-reindex-secret': REINDEX_SECRET },
        body: JSON.stringify({ source, refId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) return data.action;
      lastErr = `HTTP ${res.status} ${JSON.stringify(data)}`;
    } catch (e) { lastErr = String(e); }
    if (a < RETRY_MS.length) await new Promise((r) => setTimeout(r, RETRY_MS[a]));
  }
  throw new Error(lastErr);
}

const issues = await listIds('issues');
const agendas = await listIds('agendas');
console.log(`백필 대상: issues ${issues.length} + agendas ${agendas.length}`);
const tally = { upserted: 0, excluded: 0, deleted: 0 };
const jobs = [...issues.map((id) => ['issue', id]), ...agendas.map((id) => ['agenda', id])];
for (let i = 0; i < jobs.length; i++) {
  const [source, id] = jobs[i];
  try {
    const action = await reindexOne(source, id);
    tally[action] = (tally[action] ?? 0) + 1;
    console.log(`${i + 1}/${jobs.length} ${source} ${id}: ${action}`);
  } catch (e) {
    console.error(`${source} ${id} 실패(재시도 소진): ${e}`); process.exit(1);
  }
}
console.log(`완료: upserted ${tally.upserted}, excluded ${tally.excluded}, deleted ${tally.deleted}. 검증 중...`);

const verify = await fetch(`${BASE}/functions/v1/rag-search`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
  body: JSON.stringify({ countOnly: true, scope: 'cases' }),
});
const vd = await verify.json().catch(() => null);
const total = verify.ok && vd?.ok ? vd.total : -1;
if (total !== tally.upserted) {
  console.error(`검증 불일치: countOnly ${total} vs upserted ${tally.upserted}. 재실행 필요.`);
  process.exit(1);
}
console.log(`검증 완료: ${total}개 색인.`);
```

- [ ] **Step 2: 문법 확인** — `node --check scripts/backfill-case-embeddings.mjs` (실행 금지 — T7).
- [ ] **Step 3: 커밋** — `feat(counsel): 사례 임베딩 백필 스크립트(행당 1콜·재시도·countOnly 검증)`

---

### Task 6: 앱 배선 (api/chat.ts + aiChat.ts + ChatWidget)

**Files:** Modify `api/chat.ts`, `src/aiChat.ts`, `src/features/chat/ChatWidget.tsx`.
**Interfaces:** Consumes `retrieveCases`(T2). `ChatBody`/`ChatRequest`에 `tenantId?: string` 추가.

- [ ] **Step 1: api/chat.ts** — import 에 `retrieveCases` 추가, `ChatBody`에 `tenantId?: string;` 추가. 룰 RAG 블록의 else 로 상담 검색 삽입(위기 단락 이후, buildMessages 이전 — 기존 effectiveBody 패턴에 이어 붙임):
```ts
  } else if (body.mode !== 'rule') {
    // 상담 모드: 서버 의미검색으로 유사사례 교체(Phase 2). 실패·미설정·tenantId 없음 → 클라 cases 폴백.
    const supabaseUrl = env('SUPABASE_URL');
    const anonKey = env('SUPABASE_ANON_KEY');
    if (supabaseUrl && anonKey && lastUser && body.tenantId) {
      const functionsUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');
      const found = await retrieveCases(lastUser, { functionsUrl, anonKey, tenantId: body.tenantId });
      if (found) effectiveBody = { ...effectiveBody, cases: found };
    }
  }
```
(룰 블록이 `if (body.mode === 'rule') {...}` 형태가 아니면 현재 구조에 맞춰 동등하게 — 룰 경로와 위기 단락은 변경 금지.)

- [ ] **Step 2: src/aiChat.ts** — `ChatRequest`에 `tenantId?: string;` 필드 추가(주석: 서버 사례 의미검색용, 없으면 서버가 클라 cases 사용).

- [ ] **Step 3: ChatWidget.tsx** — `import { getCurrentTenantId } from '../../tenantContext';` 추가, 상담 요청 조립부(`mode === 'counsel'` 분기)에 `tenantId: getCurrentTenantId() ?? undefined,` 추가. `findSimilarCases` 호출은 그대로(폴백 소스).

- [ ] **Step 4: 회귀** — `npx vitest run` 전체 그린 + `npx tsc --noEmit -p tsconfig.json`(프론트 타입).
- [ ] **Step 5: 커밋** — `feat(counsel): 상담 모드 서버 사례 RAG 배선(tenantId 전달·클라 cases 폴백)`

---

### Task 7: 배포·백필·검증 (컨트롤러+사용자)

- [ ] **Step 1 (사용자, 토큰):** `supabase db push` → 20260817200000 적용.
- [ ] **Step 2 (사용자, 토큰):** `supabase functions deploy rag-search reindex-cases`.
- [ ] **Step 3 (사용자, 1회 SQL — Supabase 대시보드 SQL Editor):** Vault 시드(값은 `.env.supabase.local`·프론트 env 와 동일):
```sql
select vault.create_secret('https://sjymcpjbmsqapsptvlml.supabase.co/functions/v1', 'counsel_functions_url');
select vault.create_secret('<REINDEX_SECRET 값>', 'counsel_reindex_secret');
select vault.create_secret('<VITE_SUPABASE_ANON_KEY 값>', 'counsel_anon_key');
```
- [ ] **Step 4 (Claude):** `node scripts/backfill-case-embeddings.mjs` → tally·검증 통과.
- [ ] **Step 5 (Claude):** 스모크 — rag-search `{scope:'cases', query:'회의에서 팀장님과 갈등', tenantId:<실값>}` 적중 확인, 시크릿 없는 reindex-cases 401, 리더만보기 이슈 미색인(countOnly·검색결과로 확인).
- [ ] **Step 6 (Claude):** 트리거 스모크 — 테스트 안건 1건 insert 후 수초 내 색인 반영 확인, 삭제 시 색인 제거 확인(pg_net 비동기라 5~10초 대기).
- [ ] **Step 7:** 최종 전체 리뷰 → dev 머지·push.

---

## Self-Review

**Spec coverage:** 정책 순수함수(§5→T1) ✓, retrieveCases(§6→T2) ✓, DB·트리거(§4→T3) ✓, reindex-cases·rag-search 확장(§5→T4) ✓, 백필(§3→T5) ✓, 앱 배선·tenantId(§6→T6) ✓, 런북(§9→T7) ✓, 폴백·프라이버시 제약(§2·7→Global Constraints) ✓.

**Placeholder scan:** T7 Vault SQL 의 `<...>` 는 사용자 시크릿 치환 자리(런북 관례, 코드 아님). T2 두 번째 테스트는 기존 파일의 동일 패턴을 따르라는 명시적 지시로 대체(구현자가 기존 테스트를 보며 작성). 그 외 TBD 없음.

**Type/이름 일관성:** `match_case_chunks(query_embedding, p_tenant, match_count)` T3↔T4 일치. reindex-cases 입출력 T4↔T5(백필)·T3(트리거 body) 일치. `retrieveCases` T2↔T6. `caseContentOf` T1↔T4. countOnly scope T4↔T5 검증.
