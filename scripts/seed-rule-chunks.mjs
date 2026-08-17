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

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('SUPABASE_URL / SUPABASE_ANON_KEY 를 찾지 못했습니다(.env.demo.local 또는 환경변수).');
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

const BATCH = 8; // 임베딩 CPU 한도(WORKER_RESOURCE_LIMIT) 회피 — 작은 배치로 나눠 보낸다.
const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/reindex-rules`;
let inserted = 0;
for (let i = 0; i < chunks.length; i += BATCH) {
  const batch = chunks.slice(i, i + BATCH);
  const mode = i === 0 ? 'replace' : 'append';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ chunks: batch, mode }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    console.error(`배치 ${i / BATCH + 1} 실패: HTTP ${res.status} ${JSON.stringify(data)}`);
    process.exit(1);
  }
  inserted += data.inserted;
  console.log(`배치 ${i / BATCH + 1}/${Math.ceil(chunks.length / BATCH)} (${mode}): +${data.inserted} (누적 ${inserted})`);
}
console.log(`완료: ${inserted}개 색인.`);
