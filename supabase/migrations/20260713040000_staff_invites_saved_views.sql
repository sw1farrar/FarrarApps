-- Staff invites, saved views, and invite-role aware profile creation
-- Applied remotely: staff_invites_saved_views_and_invite_role

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_role public.user_role := 'client';
  meta_role text := lower(coalesce(new.raw_user_meta_data->>'invited_role', ''));
begin
  if not exists (select 1 from public.profiles where role = 'owner') then
    chosen_role := 'owner';
  elsif meta_role in ('owner', 'staff', 'client') then
    chosen_role := meta_role::public.user_role;
    if chosen_role = 'owner' then
      chosen_role := 'staff';
    end if;
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    chosen_role
  );
  return new;
end;
$$;

create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  role public.user_role not null default 'staff',
  token text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create index if not exists staff_invites_email_idx on public.staff_invites (lower(email));
create index if not exists staff_invites_token_idx on public.staff_invites (token);

alter table public.staff_invites enable row level security;

drop policy if exists "Owners manage staff invites" on public.staff_invites;
create policy "Owners manage staff invites"
  on public.staff_invites for all
  to authenticated
  using (public.current_user_role() = 'owner')
  with check (public.current_user_role() = 'owner');

create or replace function public.get_staff_invite_by_token(p_token text)
returns table (
  id uuid,
  email text,
  full_name text,
  role public.user_role,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.email, i.full_name, i.role, i.expires_at, i.accepted_at
  from public.staff_invites i
  where i.token = p_token
  limit 1;
$$;

create or replace function public.accept_staff_invite(p_token text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.staff_invites%rowtype;
begin
  select * into inv from public.staff_invites where token = p_token for update;
  if not found then
    return false;
  end if;
  if inv.accepted_at is not null then
    return true;
  end if;
  if inv.expires_at < now() then
    return false;
  end if;

  update public.staff_invites
  set accepted_at = now()
  where id = inv.id;

  update public.profiles
  set role = case when inv.role = 'owner' then 'staff'::public.user_role else inv.role end,
      full_name = coalesce(nullif(full_name, ''), inv.full_name, full_name)
  where id = p_user_id;

  return true;
end;
$$;

grant execute on function public.get_staff_invite_by_token(text) to anon, authenticated;
grant execute on function public.accept_staff_invite(text, uuid) to authenticated;

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  entity_type text not null,
  filters jsonb not null default '{}'::jsonb,
  sort jsonb default '{"field":"created_at","dir":"desc"}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, entity_type, name)
);

create index if not exists saved_views_user_entity_idx on public.saved_views (user_id, entity_type);

alter table public.saved_views enable row level security;

drop policy if exists "Users manage own saved views" on public.saved_views;
create policy "Users manage own saved views"
  on public.saved_views for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
