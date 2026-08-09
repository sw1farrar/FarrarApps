-- Allow editing messages (track edits) and tighten who can update/delete.

alter table public.project_messages
  add column if not exists updated_at timestamptz;

-- Replace broad all-access policy with explicit CRUD rules.
drop policy if exists "Access project_messages" on public.project_messages;

drop policy if exists "Select project_messages" on public.project_messages;
create policy "Select project_messages"
  on public.project_messages for select to authenticated
  using (public.can_access_thread(thread_id));

drop policy if exists "Insert project_messages" on public.project_messages;
create policy "Insert project_messages"
  on public.project_messages for insert to authenticated
  with check (
    public.can_access_thread(thread_id)
    and author_id = auth.uid()
  );

drop policy if exists "Update own project_messages" on public.project_messages;
create policy "Update own project_messages"
  on public.project_messages for update to authenticated
  using (
    author_id = auth.uid()
    and public.can_access_thread(thread_id)
  )
  with check (
    author_id = auth.uid()
    and public.can_access_thread(thread_id)
  );

drop policy if exists "Delete project_messages" on public.project_messages;
create policy "Delete project_messages"
  on public.project_messages for delete to authenticated
  using (
    public.can_access_thread(thread_id)
    and (
      author_id = auth.uid()
      or public.is_staff_or_owner()
    )
  );
