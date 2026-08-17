// 룰 청크 재색인: 요청 본문의 청크들을 gte-small 로 임베딩해 rule_chunks 에 넣는다.
// 임베딩은 CPU 를 많이 써서 한 번에 많은 청크를 보내면 WORKER_RESOURCE_LIMIT 이 난다(실측).
// 그래서 호출자가 작은 배치로 나눠 보내고, 첫 배치는 mode:'replace'(전체 삭제 후 삽입),
// 이후 배치는 mode:'append'(삽입만) 로 호출한다.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const model = new Supabase.ai.Session('gte-small');

Deno.serve(async (req) => {
  // 공개 anon 키만으로는 재색인을 못 하게 막는다 — 이 테이블은 LLM 시스템 프롬프트에 주입되므로
  // 무인증 쓰기는 곧 프롬프트 오염이다. 배포 시 `supabase secrets set REINDEX_SECRET=...` 필요.
  const secret = Deno.env.get('REINDEX_SECRET');
  if (!secret || req.headers.get('x-reindex-secret') !== secret) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  try {
    const { chunks, mode = 'replace' } = await req.json();
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
    if (mode === 'replace') {
      const del = await supabase.from('rule_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (del.error) return Response.json({ ok: false, reason: del.error.message });
    }
    const ins = await supabase.from('rule_chunks').insert(rows);
    if (ins.error) return Response.json({ ok: false, reason: ins.error.message });
    return Response.json({ ok: true, inserted: rows.length, mode });
  } catch (e) {
    return Response.json({ ok: false, reason: String(e) });
  }
});
