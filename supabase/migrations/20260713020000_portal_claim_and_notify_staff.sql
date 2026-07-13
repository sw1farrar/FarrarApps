-- Allow clients to claim an unlinked customer row matching their auth email
create policy "Clients can claim customer by email"
  on public.customers for update
  to authenticated
  using (
    portal_user_id is null
    and email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    portal_user_id = auth.uid()
    and email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create or replace function public.notify_staff(
  p_title text,
  p_body text default null,
  p_href text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, href)
  select p.id, p_title, p_body, p_href
  from public.profiles p
  where p.role in ('owner', 'staff');
end;
$$;

revoke execute on function public.notify_staff(text, text, text) from public, anon;
grant execute on function public.notify_staff(text, text, text) to authenticated;
