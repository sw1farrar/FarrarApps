-- Pending login-email changes: 6-digit codes hashed, sent to the new address only
create table public.email_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  new_email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index email_change_requests_user_created_idx
  on public.email_change_requests (user_id, created_at desc);

create index email_change_requests_new_email_idx
  on public.email_change_requests (new_email);

alter table public.email_change_requests enable row level security;

-- Users can read their own requests (never raw codes — only hashes stored).
-- Inserts/updates for challenges are done via authenticated client or service role.
create policy "Users select own email change requests"
  on public.email_change_requests for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own email change requests"
  on public.email_change_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own email change requests"
  on public.email_change_requests for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
