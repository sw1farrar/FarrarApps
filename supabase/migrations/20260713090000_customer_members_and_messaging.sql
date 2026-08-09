-- Phase A: multi-user customer membership
-- Phase B: project messaging threads

create type public.customer_member_role as enum ('company_admin', 'member');

create table if not exists public.customer_members (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.customer_member_role not null default 'member',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (customer_id, user_id)
);

create index if not exists customer_members_user_idx on public.customer_members (user_id);
create index if not exists customer_members_customer_idx on public.customer_members (customer_id);

alter table public.customer_members enable row level security;

-- Seed members from legacy portal_user_id
insert into public.customer_members (customer_id, user_id, role)
select c.id, c.portal_user_id, 'company_admin'::public.customer_member_role
from public.customers c
where c.portal_user_id is not null
on conflict (customer_id, user_id) do nothing;

-- Keep portal_user_id in sync as primary company_admin for legacy filters
create or replace function public.sync_customer_portal_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customers c
  set portal_user_id = (
    select m.user_id
    from public.customer_members m
    where m.customer_id = coalesce(new.customer_id, old.customer_id)
    order by case when m.role = 'company_admin' then 0 else 1 end, m.created_at
    limit 1
  )
  where c.id = coalesce(new.customer_id, old.customer_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_customer_portal_user_id on public.customer_members;
create trigger trg_sync_customer_portal_user_id
after insert or update or delete on public.customer_members
for each row execute function public.sync_customer_portal_user_id();

create or replace function public.client_owns_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.customer_members m
    where m.customer_id = p_customer_id and m.user_id = auth.uid()
  )
  or exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.portal_user_id = auth.uid()
  );
$$;

create or replace function public.is_customer_company_admin(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.customer_members m
    where m.customer_id = p_customer_id
      and m.user_id = auth.uid()
      and m.role = 'company_admin'
  );
$$;

drop policy if exists "Clients read own customers" on public.customers;
create policy "Clients read own customers" on public.customers
  for select to authenticated using (public.client_owns_customer(id));

drop policy if exists "Staff full access customer_members" on public.customer_members;
create policy "Staff full access customer_members"
  on public.customer_members for all to authenticated
  using (public.is_staff_or_owner())
  with check (public.is_staff_or_owner());

drop policy if exists "Members read customer_members" on public.customer_members;
create policy "Members read customer_members"
  on public.customer_members for select to authenticated
  using (public.client_owns_customer(customer_id));

drop policy if exists "Company admins manage customer_members" on public.customer_members;
create policy "Company admins manage customer_members"
  on public.customer_members for delete to authenticated
  using (public.is_customer_company_admin(customer_id));

-- Portal invites: allow company admins; keep staff access
drop policy if exists "Company admins manage portal invites" on public.portal_invites;
create policy "Company admins manage portal invites"
  on public.portal_invites for all to authenticated
  using (
    public.is_staff_or_owner()
    or public.is_customer_company_admin(customer_id)
  )
  with check (
    public.is_staff_or_owner()
    or public.is_customer_company_admin(customer_id)
  );

-- Clients can create projects (briefs) for their company
drop policy if exists "Clients insert own projects" on public.projects;
create policy "Clients insert own projects"
  on public.projects for insert to authenticated
  with check (public.client_owns_customer(customer_id));

-- Accept invite: membership-based, do not invalidate other invites
create or replace function public.accept_portal_invite(p_token text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.portal_invites%rowtype;
  user_email text;
  member_count int;
  member_role public.customer_member_role;
begin
  if auth.uid() is distinct from p_user_id then
    return false;
  end if;

  select * into inv from public.portal_invites where token = p_token for update;
  if not found then
    return false;
  end if;

  if inv.accepted_at is not null then
    insert into public.customer_members (customer_id, user_id, role, invited_by)
    values (
      inv.customer_id,
      p_user_id,
      case when (
        select count(*) from public.customer_members where customer_id = inv.customer_id
      ) = 0 then 'company_admin'::public.customer_member_role
      else 'member'::public.customer_member_role end,
      inv.invited_by
    )
    on conflict (customer_id, user_id) do nothing;
    return true;
  end if;

  if inv.expires_at < now() then
    return false;
  end if;

  select email into user_email from auth.users where id = p_user_id;
  if user_email is null or lower(user_email) <> lower(inv.email) then
    return false;
  end if;

  select count(*) into member_count
  from public.customer_members
  where customer_id = inv.customer_id;

  member_role := case
    when member_count = 0 then 'company_admin'::public.customer_member_role
    else 'member'::public.customer_member_role
  end;

  update public.portal_invites
  set accepted_at = now()
  where id = inv.id;

  insert into public.customer_members (customer_id, user_id, role, invited_by)
  values (inv.customer_id, p_user_id, member_role, inv.invited_by)
  on conflict (customer_id, user_id) do update
    set role = case
      when public.customer_members.role = 'company_admin' then 'company_admin'::public.customer_member_role
      else excluded.role
    end;

  update public.customers
  set portal_user_id = coalesce(portal_user_id, p_user_id)
  where id = inv.customer_id;

  update public.profiles
  set role = 'client',
      full_name = coalesce(nullif(full_name, ''), split_part(inv.email, '@', 1))
  where id = p_user_id;

  return true;
end;
$$;

grant execute on function public.accept_portal_invite(text, uuid) to authenticated;
grant execute on function public.is_customer_company_admin(uuid) to authenticated;

-- Messaging
create table if not exists public.project_threads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  created_by uuid references auth.users (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists project_threads_project_idx
  on public.project_threads (project_id, last_message_at desc);

create table if not exists public.project_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.project_threads (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists project_messages_thread_idx
  on public.project_messages (thread_id, created_at);

create table if not exists public.project_thread_reads (
  thread_id uuid not null references public.project_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.project_threads enable row level security;
alter table public.project_messages enable row level security;
alter table public.project_thread_reads enable row level security;

create or replace function public.can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff_or_owner()
    or exists (
      select 1 from public.projects p
      where p.id = p_project_id and public.client_owns_customer(p.customer_id)
    );
$$;

create or replace function public.can_access_thread(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_threads t
    where t.id = p_thread_id and public.can_access_project(t.project_id)
  );
$$;

drop policy if exists "Access project_threads" on public.project_threads;
create policy "Access project_threads"
  on public.project_threads for all to authenticated
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

drop policy if exists "Access project_messages" on public.project_messages;
create policy "Access project_messages"
  on public.project_messages for all to authenticated
  using (public.can_access_thread(thread_id))
  with check (public.can_access_thread(thread_id) and author_id = auth.uid());

drop policy if exists "Access project_thread_reads" on public.project_thread_reads;
create policy "Access project_thread_reads"
  on public.project_thread_reads for all to authenticated
  using (user_id = auth.uid() and public.can_access_thread(thread_id))
  with check (user_id = auth.uid() and public.can_access_thread(thread_id));

create or replace function public.bump_thread_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.project_threads
  set last_message_at = new.created_at
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_thread_last_message on public.project_messages;
create trigger trg_bump_thread_last_message
after insert on public.project_messages
for each row execute function public.bump_thread_last_message();

-- Unread count per project for current user
create or replace function public.project_unread_counts(p_project_ids uuid[])
returns table (project_id uuid, unread_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.project_id,
    count(m.id)::bigint as unread_count
  from public.project_threads t
  join public.project_messages m on m.thread_id = t.id
  left join public.project_thread_reads r
    on r.thread_id = t.id and r.user_id = auth.uid()
  where t.project_id = any (p_project_ids)
    and public.can_access_project(t.project_id)
    and m.author_id is distinct from auth.uid()
    and (r.last_read_at is null or m.created_at > r.last_read_at)
  group by t.project_id;
$$;

grant execute on function public.can_access_project(uuid) to authenticated;
grant execute on function public.can_access_thread(uuid) to authenticated;
grant execute on function public.project_unread_counts(uuid[]) to authenticated;

-- Realtime
do $$
begin
  alter publication supabase_realtime add table public.project_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.project_threads;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Notify participants on new message (staff + company members except author)
create or replace function public.notify_project_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_title text;
  v_project_name text;
  v_customer_id uuid;
  v_href_staff text;
  v_href_portal text;
  v_author_name text;
begin
  select t.project_id, t.title, p.name, p.customer_id
  into v_project_id, v_title, v_project_name, v_customer_id
  from public.project_threads t
  join public.projects p on p.id = t.project_id
  where t.id = new.thread_id;

  select coalesce(nullif(pr.full_name, ''), pr.email, 'Someone')
  into v_author_name
  from public.profiles pr
  where pr.id = new.author_id;

  v_href_staff := '/projects/' || v_project_id::text || '?thread=' || new.thread_id::text;
  v_href_portal := '/portal/projects/' || v_project_id::text || '?thread=' || new.thread_id::text;

  -- Staff notifications
  insert into public.notifications (user_id, title, body, href)
  select pr.id,
         'New message: ' || v_project_name,
         v_author_name || ' in ' || v_title,
         v_href_staff
  from public.profiles pr
  where pr.role in ('owner', 'staff')
    and pr.id is distinct from new.author_id;

  -- Client member notifications
  insert into public.notifications (user_id, title, body, href)
  select m.user_id,
         'New message: ' || v_project_name,
         v_author_name || ' in ' || v_title,
         v_href_portal
  from public.customer_members m
  where m.customer_id = v_customer_id
    and m.user_id is distinct from new.author_id;

  return new;
end;
$$;

drop trigger if exists trg_notify_project_message on public.project_messages;
create trigger trg_notify_project_message
after insert on public.project_messages
for each row execute function public.notify_project_message();
