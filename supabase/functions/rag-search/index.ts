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
