-- Portal invite: return customer name + allow password set for existing auth users
drop function if exists public.get_portal_invite_by_token(text);

create function public.get_portal_invite_by_token(p_token text)
returns table (
  id uuid,
  customer_id uuid,
  email text,
  customer_name text,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id,
         i.customer_id,
         i.email,
         c.name as customer_name,
         i.expires_at,
         i.accepted_at
  from public.portal_invites i
  left join public.customers c on c.id = i.customer_id
  where i.token = p_token
  limit 1;
$$;

create or replace function public.set_password_for_portal_invite(
  p_token text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  inv public.portal_invites%rowtype;
  uid uuid;
  cust_name text;
begin
  if p_password is null or length(p_password) < 6 then
    return jsonb_build_object('ok', false, 'error', 'Password must be at least 6 characters');
  end if;

  select * into inv
  from public.portal_invites
  where token = p_token
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Invalid invite');
  end if;

  if inv.accepted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'Invite already used');
  end if;

  if inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'Invite expired');
  end if;

  select c.name into cust_name
  from public.customers c
  where c.id = inv.customer_id;

  select u.id into uid
  from auth.users u
  where lower(u.email) = lower(inv.email)
  limit 1;

  if uid is null then
    return jsonb_build_object(
      'ok', true,
      'mode', 'signup',
      'email', inv.email,
      'customer_name', coalesce(cust_name, split_part(inv.email, '@', 1))
    );
  end if;

  update auth.users
  set encrypted_password = crypt(p_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now(),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) ||
        jsonb_build_object(
          'full_name', coalesce(cust_name, split_part(inv.email, '@', 1)),
          'invited_role', 'client'
        )
  where id = uid;

  return jsonb_build_object(
    'ok', true,
    'mode', 'signin',
    'email', inv.email,
    'user_id', uid,
    'customer_name', coalesce(cust_name, split_part(inv.email, '@', 1))
  );
end;
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
  cust_name text;
begin
  if auth.uid() is distinct from p_user_id then
    return false;
  end if;

  select * into inv from public.portal_invites where token = p_token for update;
  if not found then
    return false;
  end if;

  select c.name into cust_name from public.customers c where c.id = inv.customer_id;

  if inv.accepted_at is not null then
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
      full_name = coalesce(nullif(cust_name, ''), nullif(full_name, ''), split_part(inv.email, '@', 1))
  where id = p_user_id;

  return true;
end;
$$;

grant execute on function public.get_portal_invite_by_token(text) to anon, authenticated;
grant execute on function public.set_password_for_portal_invite(text, text) to anon, authenticated;
grant execute on function public.accept_portal_invite(text, uuid) to authenticated;
