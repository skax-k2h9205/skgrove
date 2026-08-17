-- match_rule_chunks 는 SECURITY DEFINER 라 RLS 를 우회한다. 기본 PUBLIC EXECUTE 를 회수해
-- anon 이 REST rpc 로 직접 청크를 덤프하는 경로를 막는다(읽기는 rag-search Edge Function 경유만).
revoke execute on function public.match_rule_chunks(vector, int) from public;
revoke execute on function public.match_rule_chunks(vector, int) from anon;
revoke execute on function public.match_rule_chunks(vector, int) from authenticated;
grant execute on function public.match_rule_chunks(vector, int) to service_role;
