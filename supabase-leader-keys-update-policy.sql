-- leader_keys 는 SELECT·INSERT 정책만 있어 '키 재설정'(upsert→UPDATE)이 거부됐다.
-- 개방 모델과 동일하게 UPDATE 정책을 추가한다(Stage 2b RLS 락다운이 나중에 테넌트 스코프로 교체).
-- Supabase SQL Editor 에 1회 실행. 멱등.
drop policy if exists leader_keys_update on public.leader_keys;
create policy leader_keys_update on public.leader_keys
  for update using (true) with check (true);
