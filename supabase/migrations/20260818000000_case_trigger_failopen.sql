-- 최종 리뷰 반영: (1) 색인 트리거 fail-open, (2) 유사도 하한 RPC 오버로드.
-- 20260817200000_case_rag.sql 은 이미 프로덕션에 적용되어 있어 직접 수정하지 않고
-- 이 신규 마이그레이션에서 create or replace 로 갈아끼운다.

-- ── (1) 트리거는 색인 편의 기능일 뿐이다. 여기서 예외가 나면 AFTER 트리거가 사용자의
-- INSERT/UPDATE/DELETE 자체를 롤백시켜 대나무숲 접수가 막힌다(권한·네트워크·URL 오설정 등).
-- 어떤 실패든 삼키고 원래 쓰기를 통과시킨다 — 색인 누락은 백필 스크립트로 복구 가능하다.
create or replace function public.notify_case_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text; v_secret text; v_anon text;
  v_source text := case when tg_table_name = 'issues' then 'issue' else 'agenda' end;
  v_ref text;
begin
  v_ref := coalesce(new.id, old.id);
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'counsel_functions_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'counsel_reindex_secret';
  select decrypted_secret into v_anon from vault.decrypted_secrets where name = 'counsel_anon_key';
  if v_url is null or v_secret is null or v_anon is null then
    return coalesce(new, old);
  end if;
  perform net.http_post(
    url := v_url || '/reindex-cases',
    body := jsonb_build_object('source', v_source, 'refId', v_ref),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-reindex-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );
  return coalesce(new, old);
exception when others then
  return coalesce(new, old);
end;
$$;

-- ── (2) 유사도 하한이 있는 4-인자 오버로드. 기존 3-인자 시그니처는 그대로 유지된다
-- (reindex-cases 등 기존 호출부 무변경). rag-search 는 이 4-인자 버전을 호출해 무관한
-- 사례까지 top-k 로 항상 주입되는 문제를 완화한다.
create or replace function public.match_case_chunks(
  query_embedding vector(384),
  p_tenant text,
  match_count int default 6,
  p_min_similarity float default 0
)
returns table (source text, ref_id text, title text, status text, snippet text, similarity float)
language sql stable
security definer
set search_path = public
as $$
  select ce.source, ce.ref_id, ce.title, ce.status, ce.snippet,
         1 - (ce.embedding <=> query_embedding) as similarity
  from public.case_embeddings ce
  where ce.embedding is not null
    and ce.tenant_id is not distinct from p_tenant
    and 1 - (ce.embedding <=> query_embedding) >= p_min_similarity
  order by ce.embedding <=> query_embedding
  limit greatest(1, match_count);
$$;

revoke execute on function public.match_case_chunks(vector, text, int, float) from public;
revoke execute on function public.match_case_chunks(vector, text, int, float) from anon;
revoke execute on function public.match_case_chunks(vector, text, int, float) from authenticated;
grant execute on function public.match_case_chunks(vector, text, int, float) to service_role;
