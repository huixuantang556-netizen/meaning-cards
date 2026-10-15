-- 在测试项目 SQL Editor 以 postgres 运行。全部通过后 rollback，不保留测试数据。
begin;
insert into auth.users(id,email) values
 ('a1111111-1111-4111-8111-111111111111','meaning-test-a@example.invalid'),
 ('b2222222-2222-4222-8222-222222222222','meaning-test-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
do $$
declare r jsonb;
begin
 r:=public.save_meaning_library(0,'[{"id":"a","title":"A"}]','11111111-1111-4111-8111-111111111111');
 if not (r->>'ok')::boolean or (r->'current'->>'revision')::int<>1 then raise exception 'Initial save failed'; end if;
 r:=public.save_meaning_library(0,'[{"id":"a","title":"A"}]','11111111-1111-4111-8111-111111111111');
 if not (r->>'ok')::boolean or (r->'current'->>'revision')::int<>1 then raise exception 'Idempotency failed'; end if;
 r:=public.save_meaning_library(0,'[]','22222222-2222-4222-8222-222222222222');
 if (r->>'ok')::boolean then raise exception 'Stale revision accepted'; end if;
 begin
  update public.meaning_libraries set cards='[]';
  raise exception 'Direct write unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
 if (select count(*) from public.meaning_libraries)<>1 then raise exception 'Own read failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','b2222222-2222-4222-8222-222222222222',true);
do $$
begin
 if (select count(*) from public.meaning_libraries)<>0 then raise exception 'Cross-user data exposed'; end if;
 perform public.save_meaning_library(0,'[{"id":"b","title":"B"}]','33333333-3333-4333-8333-333333333333');
 if (select count(*) from public.meaning_libraries)<>1 then raise exception 'User B isolation failed'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$
begin
 begin
  perform * from public.meaning_libraries;
  raise exception 'Anonymous read unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.save_meaning_library(0,'[]','44444444-4444-4444-8444-444444444444');
  raise exception 'Anonymous write unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
