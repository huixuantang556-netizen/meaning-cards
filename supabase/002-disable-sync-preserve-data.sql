-- Optional emergency server-side stop, only with approval. PRESERVES ALL DATA.
begin;
revoke execute on function public.save_meaning_encrypted_library(bigint,text,uuid) from authenticated;
commit;
-- To resume after reviewing the issue:
-- grant execute on function public.save_meaning_encrypted_library(bigint,text,uuid) to authenticated;
