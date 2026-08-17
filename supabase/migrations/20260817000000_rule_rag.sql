-- 룰 RAG: 벡터 검색용 확장·테이블·인덱스·검색 RPC.
create extension if not exists vector;

create table if not exists public.rule_chunks (
  id uuid primary key default gen_random_uuid(),
  doc text not null,
  heading text not null,
  content text not null,
  embedding vector(384),
  updated_at timestamptz not null default now()
);

-- HNSW 코사인 인덱스(소규모 코퍼스에 충분).
create index if not exists rule_chunks_embedding_idx
  on public.rule_chunks using hnsw (embedding vector_cosine_ops);

-- 최소권한: 테이블 직접 접근 차단(anon/authenticated). 검색은 아래 RPC(SECURITY DEFINER)로만.
alter table public.rule_chunks enable row level security;
-- (RLS 정책 미부여 = 기본 거부. Edge Function 은 service_role 로 RPC 를 통해 접근.)

-- 코사인 유사도 상위 match_count 청크 반환.
create or replace function public.match_rule_chunks(
  query_embedding vector(384),
  match_count int default 20
)
returns table (doc text, heading text, content text, similarity float)
language sql stable
security definer
set search_path = public
as $$
  select rc.doc, rc.heading, rc.content,
         1 - (rc.embedding <=> query_embedding) as similarity
  from public.rule_chunks rc
  where rc.embedding is not null
  order by rc.embedding <=> query_embedding
  limit greatest(1, match_count);
$$;

-- Edge Function(service_role)이 호출. anon 직접 실행은 불필요하므로 부여하지 않는다.
grant execute on function public.match_rule_chunks(vector, int) to service_role;
