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

// PostgREST 는 기본적으로 응답을 1000행으로 잘라 반환한다(설정에 따라 더 낮을 수도 있음).
// Range 헤더로 페이지네이션하여 짧은 페이지(PAGE 미만)가 나올 때까지 누적한다.
const PAGE = 1000;
async function listIds(table) {
  const ids = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`${BASE}/rest/v1/${table}?select=id`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        Range: `${offset}-${offset + PAGE - 1}`,
      },
    });
    if (!res.ok) { console.error(`${table} 목록 실패 HTTP ${res.status}`); process.exit(1); }
    const page = await res.json();
    ids.push(...page.map((r) => r.id));
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return ids;
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

// jobs 목록이 페이지네이션 버그 등으로 조용히 짧아지면 이 등식이 깨진다 — 조기 발견용.
const tallySum = tally.upserted + tally.excluded + tally.deleted;
if (tallySum !== jobs.length) {
  console.error(`집계 불일치: tally 합 ${tallySum} !== jobs ${jobs.length}. 목록 조회가 누락됐을 수 있음.`);
  process.exit(1);
}

// 원본이 삭제됐는데 색인에 남은 고아 행을 정리한다 — 없으면 검증 등식(total===upserted)이 영원히 어긋난다.
for (const [source, ids] of [['issue', issues], ['agenda', agendas]]) {
  const res = await fetch(`${BASE}/functions/v1/reindex-cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}`, 'x-reindex-secret': REINDEX_SECRET },
    body: JSON.stringify({ prune: true, source, keepIds: ids }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    console.error(`${source} 고아 정리 실패: HTTP ${res.status} ${JSON.stringify(data)}`);
    process.exit(1);
  }
  if (data.deleted > 0) console.log(`${source} 고아 ${data.deleted}건 정리.`);
}

const verify = await fetch(`${BASE}/functions/v1/rag-search`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
  body: JSON.stringify({ countOnly: true, scope: 'cases' }),
});
const vd = await verify.json().catch(() => null);
const total = verify.ok && vd?.ok ? vd.total : -1;
// 이 등식(countOnly === upserted)은 위에서 고아 색인을 이미 정리했기 때문에 구조적으로
// 성립해야 하는 값이다 — 실제 검증은 그 정리(prune)와 tallySum 어서션이 한다. 여기서는
// 그 구성이 깨지지 않았는지 마지막으로 재확인하는 것뿐이다.
if (total !== tally.upserted) {
  console.error(`검증 불일치: countOnly ${total} vs upserted ${tally.upserted}. 재실행 필요.`);
  process.exit(1);
}
console.log(`검증 완료: ${total}개 색인 (원본 issues ${issues.length} + agendas ${agendas.length}, 페이지네이션 조회).`);
