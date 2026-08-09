-- Allow staff invites to assign owner/staff/client roles as chosen
create or replace function public.accept_staff_invite(p_token text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.staff_invites%rowtype;
  user_email text;
begin
  if auth.uid() is distinct from p_user_id then
    return false;
  end if;

  select * into inv from public.staff_invites where token = p_token for update;
  if not found then
    return false;
  end if;

  if inv.accepted_at is not null then
    update public.profiles
    set role = inv.role,
        full_name = coalesce(nullif(full_name, ''), inv.full_name, full_name)
    where id = p_user_id;
    return true;
  end if;

  if inv.expires_at < now() then
    return false;
  end if;

  select email into user_email from auth.users where id = p_user_id;
  if user_email is null or lower(user_email) <> lower(inv.email) then
    return false;
  end if;

  update public.staff_invites
  set accepted_at = now()
  where id = inv.id;

  update public.profiles
  set role = inv.role,
      full_name = coalesce(nullif(full_name, ''), inv.full_name, full_name)
  where id = p_user_id;

  return true;
end;
$$;
