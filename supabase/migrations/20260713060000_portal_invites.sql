-- Portal invites: app-owned invite tokens (no Supabase Auth emails)
create table if not exists public.portal_invites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  email text not null,
  token text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create index if not exists portal_invites_customer_idx on public.portal_invites (customer_id);
create index if not exists portal_invites_email_idx on public.portal_invites (lower(email));
create index if not exists portal_invites_token_idx on public.portal_invites (token);

alter table public.portal_invites enable row level security;

drop policy if exists "Staff manage portal invites" on public.portal_invites;
create policy "Staff manage portal invites"
  on public.portal_invites for all
  to authenticated
  using (public.current_user_role() in ('owner', 'staff'))
  with check (public.current_user_role() in ('owner', 'staff'));

create or replace function public.get_portal_invite_by_token(p_token text)
returns table (
  id uuid,
  customer_id uuid,
  email text,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.customer_id, i.email, i.expires_at, i.accepted_at
  from public.portal_invites i
  where i.token = p_token
  limit 1;
$$;

create or replace function public.accept_portal_invite(p_token text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.portal_invites%rowtype;
  user_email text;
begin
  if auth.uid() is distinct from p_user_id then
    return false;
  end if;

  select * into inv from public.portal_invites where token = p_token for update;
  if not found then
    return false;
  end if;

  if inv.accepted_at is not null then
    -- Idempotent: ensure link still exists
    update public.customers
    set portal_user_id = coalesce(portal_user_id, p_user_id)
    where id = inv.customer_id
      and (portal_user_id is null or portal_user_id = p_user_id);
    return true;
  end if;

  if inv.expires_at < now() then
    return false;
  end if;

  select email into user_email from auth.users where id = p_user_id;
  if user_email is null or lower(user_email) <> lower(inv.email) then
    return false;
  end if;

  -- Customer must still be unlinked (or already linked to this user)
  if exists (
    select 1 from public.customers c
    where c.id = inv.customer_id
      and c.portal_user_id is not null
      and c.portal_user_id <> p_user_id
  ) then
    return false;
  end if;

  update public.portal_invites
  set accepted_at = now()
  where id = inv.id;

  -- Invalidate other open invites for this customer
  update public.portal_invites
  set accepted_at = coalesce(accepted_at, now())
  where customer_id = inv.customer_id
    and id <> inv.id
    and accepted_at is null;

  update public.customers
  set portal_user_id = p_user_id
  where id = inv.customer_id
    and (portal_user_id is null or portal_user_id = p_user_id);

  update public.profiles
  set role = 'client',
      full_name = coalesce(nullif(full_name, ''), split_part(inv.email, '@', 1))
  where id = p_user_id;

  return true;
end;
$$;

grant execute on function public.get_portal_invite_by_token(text) to anon, authenticated;
grant execute on function public.accept_portal_invite(text, uuid) to authenticated;
