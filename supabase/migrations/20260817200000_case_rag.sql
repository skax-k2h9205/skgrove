-- 상담 사례 RAG: 색인 테이블·검색 RPC·행 단위 준실시간 색인 트리거(pg_net→Edge).
create extension if not exists pg_net;

create table if not exists public.case_embeddings (
  source text not null check (source in ('issue','agenda')),
  ref_id text not null,
  tenant_id text,
  title text not null,
  status text not null default '',
  snippet text not null default '',
  content text not null,
  embedding vector(384),
  updated_at timestamptz not null default now(),
  primary key (source, ref_id)
);

create index if not exists case_embeddings_embedding_idx
  on public.case_embeddings using hnsw (embedding vector_cosine_ops);

alter table public.case_embeddings enable row level security; -- 정책 없음 = 전면 거부

create or replace function public.match_case_chunks(
  query_embedding vector(384),
  p_tenant text,
  match_count int default 6
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
  order by ce.embedding <=> query_embedding
  limit greatest(1, match_count);
$$;

revoke execute on function public.match_case_chunks(vector, text, int) from public;
revoke execute on function public.match_case_chunks(vector, text, int) from anon;
revoke execute on function public.match_case_chunks(vector, text, int) from authenticated;
grant execute on function public.match_case_chunks(vector, text, int) to service_role;

-- 행 변경 → Edge reindex-cases 에 1건 POST. Vault 미시드면 조용히 건너뜀(색인만 지연, 비차단).
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
end;
$$;

drop trigger if exists issues_case_embed on public.issues;
create trigger issues_case_embed
  after insert or update or delete on public.issues
  for each row execute function public.notify_case_change();

drop trigger if exists agendas_case_embed on public.agendas;
create trigger agendas_case_embed
  after insert or update or delete on public.agendas
  for each row execute function public.notify_case_change();
