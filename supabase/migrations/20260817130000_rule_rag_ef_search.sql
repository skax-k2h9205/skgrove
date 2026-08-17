-- match_rule_chunks 가 HNSW 기본 ef_search(40)에 걸려 LIMIT>40 요청도 최대 40행만
-- 반환하던 문제 수정(실측: matchCount 41·50 → 40). 시드 후 전체 개수 검증이 이 함수로
-- 전수 조회를 하므로 함수 레벨 GUC 로 스캔 폭을 넉넉히 올린다. 코퍼스가 수백 규모라
-- 성능 영향은 무시 가능. 프로덕션 검색(match_count=20)은 원래도 영향 없던 경로다.
-- create or replace 는 기존 ACL(20260817120000 lockdown 의 revoke/grant)을 보존한다.
create or replace function public.match_rule_chunks(
  query_embedding vector(384),
  match_count int default 20
)
returns table (doc text, heading text, content text, similarity float)
language sql stable
security definer
set search_path = public
set hnsw.ef_search = 200
as $$
  select rc.doc, rc.heading, rc.content,
         1 - (rc.embedding <=> query_embedding) as similarity
  from public.rule_chunks rc
  where rc.embedding is not null
  order by rc.embedding <=> query_embedding
  limit greatest(1, match_count);
$$;
