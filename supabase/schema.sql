-- Daytime — Supabase schema
-- Run this once in the Supabase SQL editor. It is idempotent.
--
-- Shape: one workspace holds one Daytime state document (JSONB). People are
-- members of a workspace. The document is written through a compare-and-swap
-- RPC so a concurrent write is detected rather than silently overwritten.

-- ---------------------------------------------------------------- tables --

create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Daytime',
  owner_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Lets you invite someone who has not signed up yet: the row is claimed the
-- first time an account with that email signs in.
create table if not exists public.workspace_invites (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        text not null,
  role         text not null default 'editor' check (role in ('editor', 'viewer')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, email)
);

create table if not exists public.workspace_state (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  state        jsonb  not null,
  version      bigint not null default 1,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id)
);

-- ------------------------------------------------------------- helpers --
-- SECURITY DEFINER so the membership check does not re-enter the policies that
-- call it. Without this, workspaces and workspace_members reference each other
-- and every query fails with infinite recursion.

create or replace function public.is_workspace_member(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_write_workspace(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace
      and m.user_id = auth.uid()
      and m.role in ('owner', 'editor')
  );
$$;

-- ------------------------------------------------------------------ rls --

alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.workspace_state   enable row level security;

drop policy if exists ws_select on public.workspaces;
create policy ws_select on public.workspaces
  for select using (public.is_workspace_member(id));

drop policy if exists ws_update on public.workspaces;
create policy ws_update on public.workspaces
  for update using (owner_id = auth.uid());

drop policy if exists wm_select on public.workspace_members;
create policy wm_select on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists wm_owner_write on public.workspace_members;
create policy wm_owner_write on public.workspace_members
  for all using (
    exists (select 1 from public.workspaces w
            where w.id = workspace_id and w.owner_id = auth.uid())
  );

drop policy if exists wi_owner_all on public.workspace_invites;
create policy wi_owner_all on public.workspace_invites
  for all using (
    exists (select 1 from public.workspaces w
            where w.id = workspace_id and w.owner_id = auth.uid())
  );

drop policy if exists wst_select on public.workspace_state;
create policy wst_select on public.workspace_state
  for select using (public.is_workspace_member(workspace_id));

-- Writes go through save_state(), never straight at the table, so that the
-- version check cannot be bypassed.
drop policy if exists wst_write on public.workspace_state;
create policy wst_write on public.workspace_state
  for all using (false) with check (false);

-- --------------------------------------------------------------- rpcs --

-- Returns the caller's workspace, creating one on first sign-in and claiming
-- any invitation addressed to their email.
create or replace function public.ensure_workspace()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_ws    uuid;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;

  select email into v_email from auth.users where id = v_user;

  -- Claim any pending invitations for this address.
  insert into public.workspace_members (workspace_id, user_id, role)
  select i.workspace_id, v_user, i.role
  from public.workspace_invites i
  where lower(i.email) = lower(v_email)
  on conflict (workspace_id, user_id) do nothing;

  delete from public.workspace_invites
  where lower(email) = lower(v_email);

  -- Prefer a workspace they already belong to.
  select m.workspace_id into v_ws
  from public.workspace_members m
  where m.user_id = v_user
  order by (m.role = 'owner') desc, m.created_at asc
  limit 1;

  if v_ws is not null then
    return v_ws;
  end if;

  insert into public.workspaces (owner_id) values (v_user) returning id into v_ws;
  insert into public.workspace_members (workspace_id, user_id, role)
    values (v_ws, v_user, 'owner');
  return v_ws;
end;
$$;

-- Compare-and-swap write. p_expected is the version the client last saw; pass 0
-- to create the first revision. Always returns the row that is now current, so
-- a losing writer gets the winner's document back in the same round trip and
-- can merge without a second request.
create or replace function public.save_state(
  p_workspace uuid,
  p_state     jsonb,
  p_expected  bigint
)
returns table (ok boolean, version bigint, state jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current bigint;
begin
  if not public.can_write_workspace(p_workspace) then
    raise exception 'not allowed to write this workspace';
  end if;

  select ws.version into v_current
  from public.workspace_state ws
  where ws.workspace_id = p_workspace
  for update;

  if v_current is null then
    insert into public.workspace_state (workspace_id, state, version, updated_by)
      values (p_workspace, p_state, 1, auth.uid());
    return query select true, 1::bigint, p_state;
    return;
  end if;

  if v_current <> p_expected then
    return query
      select false, ws.version, ws.state
      from public.workspace_state ws
      where ws.workspace_id = p_workspace;
    return;
  end if;

  update public.workspace_state ws
     set state = p_state,
         version = ws.version + 1,
         updated_at = now(),
         updated_by = auth.uid()
   where ws.workspace_id = p_workspace
   returning ws.version, ws.state into v_current, p_state;

  return query select true, v_current, p_state;
end;
$$;

-- Invite by email. The person does not need an account yet.
create or replace function public.invite_member(
  p_workspace uuid,
  p_email     text,
  p_role      text default 'editor'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  if not exists (select 1 from public.workspaces w
                 where w.id = p_workspace and w.owner_id = auth.uid()) then
    raise exception 'only the workspace owner can invite';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(p_email);

  if v_uid is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
      values (p_workspace, v_uid, p_role)
      on conflict (workspace_id, user_id) do update set role = excluded.role;
  else
    insert into public.workspace_invites (workspace_id, email, role)
      values (p_workspace, lower(p_email), p_role)
      on conflict (workspace_id, email) do update set role = excluded.role;
  end if;
end;
$$;

-- Who is in this workspace, for the members list in the app.
create or replace function public.workspace_people(p_workspace uuid)
returns table (email text, role text, pending boolean)
language sql
stable
security definer
set search_path = public
as $$
  select u.email::text, m.role, false
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = p_workspace
    and public.is_workspace_member(p_workspace)
  union all
  select i.email, i.role, true
  from public.workspace_invites i
  where i.workspace_id = p_workspace
    and public.is_workspace_member(p_workspace);
$$;

-- --------------------------------------------------------------- grants --
-- Supabase grants these to new objects in `public` by default. Stating them
-- anyway costs nothing and removes a whole class of "permission denied" that is
-- miserable to diagnose from the browser.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete
  on public.workspaces, public.workspace_members,
     public.workspace_invites, public.workspace_state
  to authenticated;
grant execute on function
  public.ensure_workspace(), public.save_state(uuid, jsonb, bigint),
  public.invite_member(uuid, text, text), public.workspace_people(uuid)
  to authenticated;

-- ---------------------------------------------------------- realtime --

-- Guarded so the whole file stays safe to run twice: adding a table that is
-- already in the publication is an error, not a no-op.
do $$
begin
  alter publication supabase_realtime add table public.workspace_state;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'supabase_realtime publication not found — enable Realtime for this table in the dashboard';
end $$;

alter table public.workspace_state replica identity full;
