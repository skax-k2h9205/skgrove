// RAG 쿼리 함수: gte-small 로 질문을 임베딩하고 scope 별 RPC 로 top-k 청크를 돌려준다.
// scope='rules'(기본, Phase 1b): match_rule_chunks. scope='cases'(Phase 2): match_case_chunks(테넌트 필터).
// 호출자는 Vercel 함수(api/chat.ts)이며 anon 키를 Bearer 로 전달한다(verify_jwt 기본값 사용).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const model = new Supabase.ai.Session('gte-small');

Deno.serve(async (req) => {
  try {
    const { query, matchCount, countOnly = false, scope = 'rules', tenantId = null } = await req.json();
    const k = matchCount ?? (scope === 'cases' ? 6 : 20);
    // 시드 후 전체 개수 검증용. HNSW ef_search 캡(기본 40) 탓에 LIMIT 로는 40행까지만
    // 세어져서, service_role 로 정확한 count 를 직접 돌려준다(임베딩·검색 불필요).
    if (countOnly) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const table = scope === 'cases' ? 'case_embeddings' : 'rule_chunks';
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) return Response.json({ ok: false, reason: error.message });
      return Response.json({ ok: true, total: count ?? 0 });
    }
    if (!query || typeof query !== 'string') {
      return Response.json({ ok: false, reason: 'query required' }, { status: 400 });
    }
    // 384차원 임베딩. 문서 색인(reindex-rules/reindex-cases)과 동일 옵션이어야 벡터가 호환된다.
    const embedding = await model.run(query, { mean_pool: true, normalize: true });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (scope === 'cases') {
      const { data, error } = await supabase.rpc('match_case_chunks', {
        query_embedding: embedding,
        p_tenant: tenantId,
        match_count: k,
      });
      if (error) return Response.json({ ok: false, reason: error.message });
      const chunks = (data ?? []).map((r: { source: string; ref_id: string; title: string; status: string; snippet: string }) => ({
        source: r.source, refId: r.ref_id, title: r.title, status: r.status, snippet: r.snippet,
      }));
      return Response.json({ ok: true, chunks });
    }

    const { data, error } = await supabase.rpc('match_rule_chunks', {
      query_embedding: embedding,
      match_count: k,
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
