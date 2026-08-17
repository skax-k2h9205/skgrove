-- 상담 사례 RAG 트리거가 쓸 값. Supabase 대시보드 SQL Editor 에서 1회 실행.
-- <...> 를 실제 값으로 치환한다(REINDEX_SECRET 은 .env.supabase.local, anon 키는 프론트 VITE_SUPABASE_ANON_KEY).
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'counsel_functions_url');
select vault.create_secret('<REINDEX_SECRET>', 'counsel_reindex_secret');
select vault.create_secret('<VITE_SUPABASE_ANON_KEY>', 'counsel_anon_key');
