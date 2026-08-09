-- Guest-facing invoice payment links (token hashed at rest; raw token only in URL/email)

create table if not exists public.invoice_payment_links (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists invoice_payment_links_invoice_idx
  on public.invoice_payment_links (invoice_id);

create index if not exists invoice_payment_links_expires_idx
  on public.invoice_payment_links (expires_at)
  where revoked_at is null;

alter table public.invoice_payment_links enable row level security;

drop policy if exists "Staff full access invoice_payment_links" on public.invoice_payment_links;
create policy "Staff full access invoice_payment_links"
  on public.invoice_payment_links
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'staff')
    )
  );
