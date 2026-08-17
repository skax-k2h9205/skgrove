// 로컬 src/content/*.md 를 청킹해 배포된 reindex-rules Edge Function 에 직접 POST 한다.
// supabase CLI 불필요(v2.109에서 functions invoke 제거됨). anon 키는 공개 키라 사용 무방
// (함수는 verify_jwt 로 유효 JWT만 통과시키고, 내부 쓰기는 함수 안의 service_role 로 수행).
// 설정: SUPABASE_URL / SUPABASE_ANON_KEY 환경변수, 없으면 .env.demo.local 의 VITE_* 값을 읽는다.
// 사용: node scripts/seed-rule-chunks.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chunkMarkdown } from '../supabase/functions/_shared/chunk.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

function envFromFile(file, key) {
  try {
    const text = readFileSync(join(ROOT, file), 'utf8');
    const m = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`, 'm'));
    return m ? m[1].replace(/^["']|["']$/g, '') : undefined;
  } catch {
    return undefined;
  }
}

const SUPABASE_URL =
  process.env.SUPABASE_URL || envFromFile('.env.demo.local', 'VITE_SUPABASE_URL') || envFromFile('.env.ios.local', 'VITE_SUPABASE_URL');
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY || envFromFile('.env.demo.local', 'VITE_SUPABASE_ANON_KEY') || envFromFile('.env.ios.local', 'VITE_SUPABASE_ANON_KEY');
const REINDEX_SECRET =
  process.env.REINDEX_SECRET || envFromFile('.env.supabase.local', 'REINDEX_SECRET');

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('SUPABASE_URL / SUPABASE_ANON_KEY 를 찾지 못했습니다(.env.demo.local 또는 환경변수).');
  process.exit(1);
}
if (!REINDEX_SECRET) {
  console.error('REINDEX_SECRET 를 찾지 못했습니다(.env.supabase.local 또는 환경변수). reindex-rules 는 이 비밀헤더 없이는 재색인을 거부합니다.');
  process.exit(1);
}

const CONTENT = join(ROOT, 'src', 'content');
const chunks = [];
for (const f of readdirSync(CONTENT).filter((f) => f.endsWith('.md')).sort()) {
  chunks.push(...chunkMarkdown(readFileSync(join(CONTENT, f), 'utf8'), f));
}
if (chunks.length === 0) {
  console.error('청크가 없습니다. src/content/*.md 확인.');
  process.exit(1);
}

console.log(`청크 ${chunks.length}개 → reindex-rules 배치 POST...`);

const BATCH = 1; // 임베딩 CPU 한도(WORKER_RESOURCE_LIMIT) 회피 — 실측: 요청당 1개만 안전(3개도 546).
const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/reindex-rules`;
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${ANON_KEY}`,
  'x-reindex-secret': REINDEX_SECRET,
};

// 배치 하나가 중간에 실패하면(일시적 네트워크/함수 오류) 인덱스가 잘린 채로 남는다.
// 3회까지 재시도(1s/3s 백오프)하고, 그래도 실패하면 즉시 중단한다.
const RETRY_DELAYS_MS = [1000, 3000];
async function postBatchWithRetry(body) {
  let lastErr;
  for (let attempt = 0; attempt < 1 + RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) return data;
      lastErr = `HTTP ${res.status} ${JSON.stringify(data)}`;
    } catch (e) {
      lastErr = String(e);
    }
    if (attempt < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[attempt];
      console.error(`  재시도 ${attempt + 1}/${RETRY_DELAYS_MS.length} 실패(${lastErr}), ${delay / 1000}s 후 재시도...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(lastErr);
}

let inserted = 0;
for (let i = 0; i < chunks.length; i += BATCH) {
  const batch = chunks.slice(i, i + BATCH);
  const mode = i === 0 ? 'replace' : 'append';
  let data;
  try {
    data = await postBatchWithRetry({ chunks: batch, mode });
  } catch (e) {
    console.error(`배치 ${i / BATCH + 1} 실패(재시도 소진): ${e}`);
    process.exit(1);
  }
  inserted += data.inserted;
  console.log(`배치 ${i / BATCH + 1}/${Math.ceil(chunks.length / BATCH)} (${mode}): +${data.inserted} (누적 ${inserted})`);
}
console.log(`완료: ${inserted}개 색인. 검증 중...`);

// 배치가 전부 ok 여도 실제 색인이 어긋날 수 있으니 정확한 행 개수로 검증한다.
// (LIMIT 기반 검증은 HNSW ef_search 캡=40에 걸려 40개 초과를 못 센다 — 실측.)
const verifyRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/rag-search`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
  body: JSON.stringify({ countOnly: true }),
});
const verifyData = await verifyRes.json().catch(() => null);
const verifiedCount = verifyRes.ok && verifyData?.ok ? verifyData.total : -1;
if (verifiedCount !== chunks.length) {
  console.error(
    `부분 색인 상태 — 전체 재실행 필요(mode:replace가 처음부터 다시 덮어씀). 기대 ${chunks.length}개, 실제 ${verifiedCount}개.`,
  );
  process.exit(1);
}
console.log(`검증 완료: ${verifiedCount}개 확인.`);
