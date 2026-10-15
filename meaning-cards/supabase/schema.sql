-- 在新 Supabase 项目 SQL Editor 中执行。可重复执行。
begin;
create table if not exists public.meaning_libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  cards jsonb not null default '[]'::jsonb check (jsonb_typeof(cards)='array' and jsonb_array_length(cards)<=5000 and octet_length(cards::text)<=2000000),
  last_op uuid,
  updated_at timestamptz not null default now()
);
alter table public.meaning_libraries enable row level security;
revoke all on public.meaning_libraries from public, anon, authenticated;
grant select on public.meaning_libraries to authenticated;
drop policy if exists own_library on public.meaning_libraries;
create policy own_library on public.meaning_libraries for select to authenticated using ((select auth.uid())=user_id);
-- Writes only through this atomic function. Identity is taken from JWT, never a caller-supplied user_id.
create or replace function public.save_meaning_library(expected_revision bigint,new_cards jsonb,operation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.meaning_libraries%rowtype;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if expected_revision is null or expected_revision<0 or operation_id is null then raise exception 'Invalid revision or operation'; end if;
  if new_cards is null or jsonb_typeof(new_cards)<>'array' then raise exception 'Cards must be an array'; end if;
  if jsonb_array_length(new_cards)>5000 or octet_length(new_cards::text)>2000000 then raise exception 'Library too large'; end if;
  if exists(select 1 from jsonb_array_elements(new_cards) c where jsonb_typeof(c)<>'object' or jsonb_typeof(c->'id') is distinct from 'string' or jsonb_typeof(c->'title') is distinct from 'string') then raise exception 'Invalid card'; end if;
  if (select count(*) from jsonb_array_elements(new_cards)) <> (select count(distinct c->>'id') from jsonb_array_elements(new_cards) c) then raise exception 'Duplicate IDs'; end if;
  insert into public.meaning_libraries(user_id) values(uid) on conflict (user_id) do nothing;
  select * into r from public.meaning_libraries where user_id=uid for update;
  if r.last_op=operation_id then return jsonb_build_object('ok',true,'current',to_jsonb(r)); end if;
  if r.revision<>expected_revision then return jsonb_build_object('ok',false,'current',to_jsonb(r)); end if;
  update public.meaning_libraries set cards=new_cards,revision=revision+1,last_op=operation_id,updated_at=now() where user_id=uid returning * into r;
  return jsonb_build_object('ok',true,'current',to_jsonb(r));
end $$;
revoke all on function public.save_meaning_library(bigint,jsonb,uuid) from public,anon;
grant execute on function public.save_meaning_library(bigint,jsonb,uuid) to authenticated;
commit;
