-- 멀티테넌트 — 파트(part) 고정 CHECK 제약 제거.
-- 파트는 이제 팀(테넌트)마다 다른 자유값(types.ts: TeamPart = string)이라, SK 파트만
-- 허용하던 DB CHECK 제약이 다른 팀 계정·안건·모임 생성을 막는다. 관련 제약을 전부 찾아 제거.
--
-- Supabase SQL Editor 에 실행. 멱등(없으면 그냥 넘어감).
do $$
declare r record;
begin
  for r in
    select conname, conrelid::regclass as tbl
    from pg_constraint
    where contype = 'c'
      and pg_get_constraintdef(oid) like '%혁신파트%'   -- SK 파트명을 참조하는 CHECK 제약
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    raise notice 'dropped constraint % on %', r.conname, r.tbl;
  end loop;
end $$;
