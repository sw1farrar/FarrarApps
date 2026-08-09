-- Stripe clearing account type + reconciliation sessions + Stripe payment log

-- Account type: stripe (cash-like clearing for online payments)
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'account_type'
      and e.enumlabel = 'stripe'
  ) then
    alter type public.account_type add value 'stripe';
  end if;
end $$;

-- Drop restrictive check if present; re-add with stripe included
alter table public.accounts drop constraint if exists accounts_supported_types_check;
alter table public.accounts
  add constraint accounts_supported_types_check
  check (type::text in ('checking', 'credit_card', 'stripe'));

create type public.reconciliation_status as enum (
  'in_progress',
  'completed',
  'void'
);

create table if not exists public.reconciliations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  statement_date date not null,
  statement_balance numeric not null,
  status public.reconciliation_status not null default 'in_progress',
  started_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reconciliations_account_status_idx
  on public.reconciliations (account_id, status, statement_date desc);

create table if not exists public.reconciliation_items (
  reconciliation_id uuid not null references public.reconciliations (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reconciliation_id, transaction_id)
);

create index if not exists reconciliation_items_txn_idx
  on public.reconciliation_items (transaction_id);

-- Stripe Checkout payment log (idempotent webhook application)
create table if not exists public.stripe_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  checkout_session_id text unique,
  payment_intent_id text unique,
  amount numeric not null,
  currency text not null default 'usd',
  status text not null default 'pending',
  transaction_id uuid references public.transactions (id) on delete set null,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_invoice_payments_invoice_idx
  on public.stripe_invoice_payments (invoice_id);

alter table public.reconciliations enable row level security;
alter table public.reconciliation_items enable row level security;
alter table public.stripe_invoice_payments enable row level security;

create policy "Staff full access reconciliations"
  on public.reconciliations
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

create policy "Staff full access reconciliation_items"
  on public.reconciliation_items
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

create policy "Staff full access stripe_invoice_payments"
  on public.stripe_invoice_payments
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

-- Portal clients can read their own payment rows
create policy "Clients read own stripe_invoice_payments"
  on public.stripe_invoice_payments
  for select
  using (
    exists (
      select 1 from public.customer_members m
      where m.customer_id = stripe_invoice_payments.customer_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.customers c
      where c.id = stripe_invoice_payments.customer_id
        and c.portal_user_id = auth.uid()
    )
  );
