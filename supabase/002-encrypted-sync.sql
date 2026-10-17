-- Requires explicit approval on the selected Supabase project. Never deletes old tables.
begin;
do $$ begin
 if to_regclass('public.meaning_encrypted_libraries') is not null then
  raise exception 'Encrypted table already exists; inspect installed version rather than overwriting it';
 end if;
end $$;
create table public.meaning_encrypted_libraries(
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null check(revision>0),
 envelope text not null check(octet_length(envelope)<=2300000),
 last_op uuid not null,
 updated_at timestamptz not null default now()
);
alter table public.meaning_encrypted_libraries enable row level security;
revoke all on public.meaning_encrypted_libraries from public,anon,authenticated;
grant select on public.meaning_encrypted_libraries to authenticated;
create policy encrypted_owner_read on public.meaning_encrypted_libraries for select to authenticated using ((select auth.uid())=user_id);
create function public.save_meaning_encrypted_library(expected_revision bigint,new_envelope text,operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.meaning_encrypted_libraries%rowtype; e jsonb;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501';end if;
 if expected_revision is null or expected_revision<0 or operation_id is null then raise exception 'Invalid revision or operation';end if;
 if new_envelope is null or octet_length(new_envelope)>2300000 then raise exception 'Envelope too large';end if;
 e:=new_envelope::jsonb;
 if jsonb_typeof(e) is distinct from 'object' or e->>'format' is distinct from 'meaning-private-vault-encrypted-v1'
 or e->>'version' is distinct from '1' or e->>'kdf' is distinct from 'PBKDF2-SHA256'
 or e->>'iterations' is distinct from '600000'
 or (select count(*) from jsonb_object_keys(e))<>7
 or coalesce(e->>'salt','') !~ '^[A-Za-z0-9+/]{22}==$'
 or coalesce(e->>'iv','') !~ '^[A-Za-z0-9+/]{16}$'
 or coalesce(e->>'ciphertext','') !~ '^[A-Za-z0-9+/]+={0,2}$'
 then raise exception 'Invalid encrypted envelope';end if;
 if expected_revision=0 then
  insert into public.meaning_encrypted_libraries(user_id,revision,envelope,last_op)
   values(uid,1,new_envelope,operation_id) on conflict(user_id) do nothing returning * into r;
  if found then return jsonb_build_object('ok',true,'current',to_jsonb(r));end if;
 end if;
 select * into r from public.meaning_encrypted_libraries where user_id=uid for update;
 if not found then return jsonb_build_object('ok',false,'current',null);end if;
 if r.last_op=operation_id then
  if r.envelope<>new_envelope then raise exception 'Operation ID reused with different content';end if;
  return jsonb_build_object('ok',true,'current',to_jsonb(r));
 end if;
 if r.revision<>expected_revision then return jsonb_build_object('ok',false,'current',to_jsonb(r));end if;
 update public.meaning_encrypted_libraries set envelope=new_envelope,revision=revision+1,last_op=operation_id,updated_at=now()
  where user_id=uid returning * into r;
 return jsonb_build_object('ok',true,'current',to_jsonb(r));
end $$;
revoke all on function public.save_meaning_encrypted_library(bigint,text,uuid) from public,anon;
grant execute on function public.save_meaning_encrypted_library(bigint,text,uuid) to authenticated;
comment on table public.meaning_encrypted_libraries is 'meaning-e2ee-v1: account-isolated encrypted snapshots; clients never send plaintext';
commit;
