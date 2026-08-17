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
