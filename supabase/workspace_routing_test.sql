-- Which workspace does an account boot into?
--
-- Signing in creates a workspace for anyone who has none, so the order of
-- "signs in" and "gets invited" decides whether two people end up sharing a
-- document or quietly holding two separate ones. The second case looks exactly
-- like working software — a full app, no error — which is why it needs a test
-- rather than a careful read.
--
-- Run against a throwaway Postgres, not your project:
--   createdb t && psql -d t -f workspace_routing_test.sql
-- It expects schema.sql beside it; adjust the \i path if you move either.

-- Stub the pieces of Supabase the schema leans on.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);

create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

-- Roles the grants target.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end $$;

-- Realtime publication the schema adds a table to.
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

\set ON_ERROR_STOP on
\i schema.sql

-- Two accounts: an owner, and someone who signs in BEFORE being invited.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'guest@example.com')
on conflict do nothing;

-- RLS is bypassed by these SECURITY DEFINER functions; run as superuser.
\echo '--- owner signs in, gets a workspace ---'
set test.uid = '11111111-1111-1111-1111-111111111111';
select public.ensure_workspace() as owner_ws \gset
\echo :owner_ws

\echo '--- guest signs in FIRST, before any invite (the trap) ---'
set test.uid = '22222222-2222-2222-2222-222222222222';
select public.ensure_workspace() as guest_solo \gset
\echo :guest_solo

\echo '--- owner now invites the guest ---'
set test.uid = '11111111-1111-1111-1111-111111111111';
select public.invite_member(:'owner_ws', 'guest@example.com', 'editor');

\echo '--- guest signs in again: which workspace do they land in? ---'
set test.uid = '22222222-2222-2222-2222-222222222222';
select public.ensure_workspace() as guest_after \gset
\echo :guest_after

select
  case
    when :'guest_after' = :'owner_ws' then 'PASS  invited guest lands in the owner workspace'
    when :'guest_after' = :'guest_solo' then 'FAIL  guest is stranded in their own solo workspace'
    else 'FAIL  guest landed somewhere unexpected'
  end as result;

-- Idempotence: signing in repeatedly must not move them or duplicate anything.
select public.ensure_workspace() as again \gset
select case when :'again' = :'owner_ws'
  then 'PASS  repeat sign-in is stable'
  else 'FAIL  repeat sign-in moved the guest' end as result;

select case when (select count(*) from public.workspace_members
                  where user_id = '22222222-2222-2222-2222-222222222222'
                    and workspace_id = :'owner_ws') = 1
  then 'PASS  exactly one membership row for the guest'
  else 'FAIL  membership rows duplicated' end as result;

select case when (select count(*) from public.workspace_invites
                  where lower(email) = 'guest@example.com') = 0
  then 'PASS  the invitation was consumed'
  else 'FAIL  the invitation is still pending' end as result;

-- A brand-new account with no invitation must still get its own workspace.
insert into auth.users (id, email)
  values ('33333333-3333-3333-3333-333333333333', 'solo@example.com')
  on conflict do nothing;
set test.uid = '33333333-3333-3333-3333-333333333333';
select public.ensure_workspace() as solo_ws \gset
select case when :'solo_ws' <> :'owner_ws' and :'solo_ws' is not null
  then 'PASS  an uninvited account still gets its own workspace'
  else 'FAIL  uninvited account went somewhere it should not' end as result;

-- The owner must be unaffected by all of this.
set test.uid = '11111111-1111-1111-1111-111111111111';
select public.ensure_workspace() as owner_again \gset
select case when :'owner_again' = :'owner_ws'
  then 'PASS  the owner stays in their own workspace'
  else 'FAIL  the owner moved' end as result;

-- What matters is where each account is *routed*, not which rows survive: the
-- guest keeps a membership in the solo workspace they accidentally made, it
-- just stops being the one they land in.
\echo '--- both accounts now boot into the same workspace ---'
set test.uid = '11111111-1111-1111-1111-111111111111';
select public.ensure_workspace() as o_final \gset
set test.uid = '22222222-2222-2222-2222-222222222222';
select public.ensure_workspace() as g_final \gset
select case when :'o_final' = :'g_final'
  then 'PASS  owner and guest boot into the same workspace'
  else 'FAIL  owner and guest boot into different workspaces' end as result;

-- And that is the workspace holding the shared document, not a third one.
select case when :'o_final' = :'owner_ws'
  then 'PASS  it is the original owner workspace, so its document is intact'
  else 'FAIL  they converged on the wrong workspace' end as result;

-- The stranded solo workspace is left alone rather than deleted; nothing reads
-- from it any more, but destroying data on sign-in would be far worse.
select case when exists (select 1 from public.workspaces where id = :'guest_solo')
  then 'PASS  the abandoned solo workspace is left intact, not destroyed'
  else 'FAIL  sign-in deleted a workspace' end as result;
