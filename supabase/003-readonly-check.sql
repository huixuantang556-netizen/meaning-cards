-- Read-only structural verification; no user data is read or changed.
select current_database() as database_name;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='meaning_encrypted_libraries';
select policyname,roles,cmd,qual from pg_policies where schemaname='public' and tablename='meaning_encrypted_libraries';
select has_table_privilege('anon','public.meaning_encrypted_libraries','SELECT') as anon_read,
 has_table_privilege('authenticated','public.meaning_encrypted_libraries','SELECT') as authenticated_read,
 has_table_privilege('authenticated','public.meaning_encrypted_libraries','INSERT') as direct_insert,
 has_table_privilege('authenticated','public.meaning_encrypted_libraries','UPDATE') as direct_update,
 has_table_privilege('authenticated','public.meaning_encrypted_libraries','DELETE') as direct_delete;
select p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') as anonymous_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p where p.oid='public.save_meaning_encrypted_library(bigint,text,uuid)'::regprocedure;
