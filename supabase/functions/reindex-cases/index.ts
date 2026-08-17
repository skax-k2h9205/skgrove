// 사례 1건 색인/삭제. 트리거(pg_net)·백필 스크립트가 행 단위로 부른다(요청당 임베딩 1회 = Edge 한도 안전).
// 정책은 _shared/caseContent.js 단일 출처 — '리더만 보기' 제외, 암호글 제목만.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { caseContentOf } from '../_shared/caseContent.js';

const model = new Supabase.ai.Session('gte-small');

Deno.serve(async (req) => {
  const secret = Deno.env.get('REINDEX_SECRET');
  if (!secret || req.headers.get('x-reindex-secret') !== secret) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  try {
    const { source, refId, prune = false, keepIds } = await req.json();

    // 백필 후 고아 정리: keepIds 에 없는 색인 행(원본이 삭제된 사례)을 지운다.
    // 임베딩이 없어 컴퓨트 부담 없음 — 한 요청으로 처리.
    if (prune) {
      if ((source !== 'issue' && source !== 'agenda') || !Array.isArray(keepIds)) {
        return Response.json({ ok: false, reason: 'prune requires source + keepIds[]' }, { status: 400 });
      }
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data: existing, error: selErr } = await supabase
        .from('case_embeddings').select('ref_id').eq('source', source);
      if (selErr) return Response.json({ ok: false, reason: selErr.message });
      const keep = new Set(keepIds.map(String));
      const extras = (existing ?? []).map((r: { ref_id: string }) => r.ref_id).filter((id: string) => !keep.has(id));
      if (extras.length > 0) {
        const del = await supabase.from('case_embeddings').delete().eq('source', source).in('ref_id', extras);
        if (del.error) return Response.json({ ok: false, reason: del.error.message });
      }
      return Response.json({ ok: true, action: 'pruned', deleted: extras.length });
    }

    if ((source !== 'issue' && source !== 'agenda') || !refId) {
      return Response.json({ ok: false, reason: 'source/refId required' }, { status: 400 });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const table = source === 'issue' ? 'issues' : 'agendas';
    const { data: row, error } = await supabase.from(table).select('*').eq('id', refId).maybeSingle();
    if (error) return Response.json({ ok: false, reason: error.message });

    const policy = row ? caseContentOf(source, row) : null;
    if (!policy) {
      // 행이 없거나(삭제) 정책상 제외 — 색인에서 지운다.
      const del = await supabase.from('case_embeddings').delete().eq('source', source).eq('ref_id', refId);
      if (del.error) return Response.json({ ok: false, reason: del.error.message });
      return Response.json({ ok: true, action: row ? 'excluded' : 'deleted' });
    }

    const embedding = await model.run(policy.content, { mean_pool: true, normalize: true });
    const up = await supabase.from('case_embeddings').upsert({
      source, ref_id: refId,
      tenant_id: (row as { tenant_id?: string | null }).tenant_id ?? null,
      title: policy.title, status: policy.status, snippet: policy.snippet, content: policy.content,
      embedding, updated_at: new Date().toISOString(),
    });
    if (up.error) return Response.json({ ok: false, reason: up.error.message });
    return Response.json({ ok: true, action: 'upserted' });
  } catch (e) {
    return Response.json({ ok: false, reason: String(e) });
  }
});
