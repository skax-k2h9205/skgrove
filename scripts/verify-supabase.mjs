// Supabase 연결·스키마 검증 — .env.local 의 VITE_SUPABASE_URL/ANON_KEY 로 접속해
// 테이블 존재 + 읽기 + (humor_posts) 쓰기/삭제 왕복을 확인한다.
// 실행: node scripts/verify-supabase.mjs   (프로젝트 루트에서)
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
try {
  const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
} catch {
  console.error('⚠️  .env.local 이 없습니다.');
  process.exit(1);
}

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key || url.includes('your-project')) {
  console.log('ℹ️  아직 .env.local 에 Supabase 설정이 없습니다(플레이스홀더).');
  console.log('    프로젝트 생성 → 스키마 실행 → Settings→API 의 URL/anon key 를 .env.local 에 넣고 다시 실행하세요.');
  process.exit(0);
}

const supabase = createClient(url, key);
const tables = [
  // 팀 공통(선민·수정)
  'accounts', 'issues', 'agendas', 'agenda_ballots', 'action_items',
  'profiles', 'connect_results', 'team_memories', 'team_memory_assets',
  // 내 기능(김승현)
  'notifications', 'humor_posts', 'humor_comments', 'tea_sessions', 'can_sessions', 'can_opinions',
];

console.log(`🔗 접속: ${url.replace(/^https:\/\//, '').split('.')[0]}.supabase.co\n`);

let ok = 0;
let missing = 0;
for (const t of tables) {
  const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
  if (error) {
    console.log(`  ❌ ${t.padEnd(20)} ${error.message}`);
    missing += 1;
  } else {
    console.log(`  ✅ ${t.padEnd(20)} ${count ?? 0} rows`);
    ok += 1;
  }
}
console.log(`\n테이블: ${ok} 정상 / ${missing} 문제\n`);

// humor_posts 쓰기/읽기/삭제 왕복(RLS 개방 정책 + 연결 최종 확인)
const testId = 'VERIFY-TEMP-ROW';
const write = await supabase.from('humor_posts').upsert({
  id: testId, author: '검증', body: 'verify write', media_url: '', created_at: '2026-08-03', liked_by: [],
}, { onConflict: 'id' });
if (write.error) {
  console.log('✍️  쓰기 테스트: ❌', write.error.message);
} else {
  const read = await supabase.from('humor_posts').select('id').eq('id', testId).maybeSingle();
  await supabase.from('humor_posts').delete().eq('id', testId);
  console.log(`✍️  쓰기/읽기/삭제 왕복: ${read.data ? '✅ 성공' : '❌ 읽기 실패'}`);
}
