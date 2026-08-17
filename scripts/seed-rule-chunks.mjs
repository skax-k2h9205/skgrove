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
