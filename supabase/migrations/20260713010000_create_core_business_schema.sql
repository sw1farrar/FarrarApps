-- Core business schema for Farrar Apps
-- Reconstructs tables that were originally applied remotely.
-- Safe to run on a fresh project after profiles/storage migration.

create type public.project_status as enum (
  'planning',
  'in_progress',
  'delivered',
  'archived'
);

create type public.invoice_status as enum (
  'draft',
  'sent',
  'paid',
  'overdue'
);

create type public.transaction_type as enum ('income', 'expense');

create type public.account_type as enum (
  'checking',
  'savings',
  'credit_card',
  'cash',
  'other'
);

create type public.category_type as enum ('income', 'expense');

create or replace function public.client_owns_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.portal_user_id = auth.uid()
  );
$$;

create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Farrar Apps',
  address text,
  email text,
  phone text,
  logo_path text,
  invoice_terms text default 'Payment is due within 30 days of invoice date.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  company text,
  notes text,
  portal_user_id uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null,
  scope text,
  status public.project_status not null default 'planning',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  due_date date,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.account_type not null default 'checking',
  opening_balance numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.category_type not null,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  invoice_number text not null unique,
  status public.invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date not null default (current_date + 30),
  notes text,
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  paid_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  rate numeric not null default 0,
  amount numeric not null default 0,
  sort_order integer not null default 0
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type public.transaction_type not null,
  amount numeric not null,
  date date not null default current_date,
  description text,
  account_id uuid not null references public.accounts (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  invoice_id uuid references public.invoices (id) on delete set null,
  receipt_path text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- updated_at triggers
do $$
declare
  t text;
begin
  foreach t in array array[
    'company_settings',
    'customers',
    'projects',
    'accounts',
    'invoices',
    'transactions'
  ]
  loop
    execute format(
      'drop trigger if exists set_%I_updated_at on public.%I;
       create trigger set_%I_updated_at
         before update on public.%I
         for each row execute function public.set_updated_at();',
      t, t, t, t
    );
  end loop;
end $$;

alter table public.company_settings enable row level security;
alter table public.customers enable row level security;
alter table public.projects enable row level security;
alter table public.project_files enable row level security;
alter table public.project_milestones enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.transactions enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;

-- Staff policies
create policy "Staff full access company_settings" on public.company_settings
  for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy "Staff full access customers" on public.customers
  for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy "Staff full access projects" on public.projects
  for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy "Staff full access project_files" on public.project_files
  for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy "Staff full access project_milestones" on public.project_milestones
  for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy "Staff full access accounts" on public.accounts
  for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy "Staff full access categories" on public.categories
  for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy "Staff full access invoices" on public.invoices
  for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy "Staff full access invoice_line_items" on public.invoice_line_items
  for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy "Staff full access transactions" on public.transactions
  for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());
create policy "Staff full access activity_logs" on public.activity_logs
  for all to authenticated using (public.is_staff_or_owner()) with check (public.is_staff_or_owner());

create policy "Users manage own notifications" on public.notifications
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Client portal read policies
create policy "Clients read own customers" on public.customers
  for select to authenticated using (portal_user_id = auth.uid());
create policy "Clients read own projects" on public.projects
  for select to authenticated using (public.client_owns_customer(customer_id));
create policy "Clients read own project files" on public.project_files
  for select to authenticated using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.client_owns_customer(p.customer_id)
    )
  );
create policy "Clients insert own project files" on public.project_files
  for insert to authenticated with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.client_owns_customer(p.customer_id)
    )
  );
create policy "Clients read own milestones" on public.project_milestones
  for select to authenticated using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.client_owns_customer(p.customer_id)
    )
  );
create policy "Clients read own invoices" on public.invoices
  for select to authenticated using (public.client_owns_customer(customer_id));
create policy "Clients read own invoice lines" on public.invoice_line_items
  for select to authenticated using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and public.client_owns_customer(i.customer_id)
    )
  );

-- Seed defaults
insert into public.company_settings (name)
select 'Farrar Apps'
where not exists (select 1 from public.company_settings);

insert into public.categories (name, type)
select v.name, v.type::public.category_type
from (values
  ('Client Payment', 'income'),
  ('Services', 'income'),
  ('Software', 'expense'),
  ('Hosting', 'expense'),
  ('Advertising', 'expense'),
  ('Office', 'expense'),
  ('Travel', 'expense'),
  ('Other', 'expense')
) as v(name, type)
where not exists (select 1 from public.categories c where c.name = v.name and c.type = v.type::public.category_type);
