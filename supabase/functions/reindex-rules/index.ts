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
