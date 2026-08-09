-- Allow PostgREST embeds onto profiles + per-thread unread
alter table public.project_messages
  drop constraint if exists project_messages_author_id_fkey;
alter table public.project_messages
  add constraint project_messages_author_id_fkey
  foreign key (author_id) references public.profiles (id) on delete cascade;

alter table public.customer_members
  drop constraint if exists customer_members_user_id_fkey;
alter table public.customer_members
  add constraint customer_members_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

create or replace function public.thread_unread_counts(p_thread_ids uuid[])
returns table (thread_id uuid, unread_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.thread_id,
    count(m.id)::bigint as unread_count
  from public.project_messages m
  left join public.project_thread_reads r
    on r.thread_id = m.thread_id and r.user_id = auth.uid()
  where m.thread_id = any (p_thread_ids)
    and public.can_access_thread(m.thread_id)
    and m.author_id is distinct from auth.uid()
    and (r.last_read_at is null or m.created_at > r.last_read_at)
  group by m.thread_id;
$$;

grant execute on function public.thread_unread_counts(uuid[]) to authenticated;
