-- Trusted devices: skip email confirmation on known computers
create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_token text not null,
  user_agent text,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_token)
);

create index trusted_devices_user_id_idx on public.trusted_devices (user_id);

alter table public.trusted_devices enable row level security;

create policy "Users manage own trusted devices"
  on public.trusted_devices for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One-time email codes for new-device confirmation
create table public.device_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_token text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index device_challenges_user_device_idx
  on public.device_challenges (user_id, device_token, created_at desc);

alter table public.device_challenges enable row level security;

create policy "Users manage own device challenges"
  on public.device_challenges for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
