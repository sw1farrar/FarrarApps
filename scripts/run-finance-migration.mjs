import { readFileSync } from "fs";
import pg from "pg";

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv(".env.local");
const connectionString = env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL missing from .env.local");
  process.exit(1);
}
if (connectionString.includes("YOUR_PASSWORD_HERE")) {
  console.error("DATABASE_URL still has the password placeholder");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log("Connected to Postgres");

  // 1) Add enum value first (must commit before using in some PG versions)
  await client.query(`
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
`);
  console.log("OK: account_type includes stripe (or already did)");

  // 2) Constraint update
  await client.query(`
alter table public.accounts drop constraint if exists accounts_supported_types_check;
alter table public.accounts
  add constraint accounts_supported_types_check
  check (type::text in ('checking', 'credit_card', 'stripe'));
`);
  console.log("OK: accounts_supported_types_check updated");

  // 3) Full finance migration remainder (idempotent pieces)
  await client.query(`
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'reconciliation_status'
  ) then
    create type public.reconciliation_status as enum (
      'in_progress',
      'completed',
      'void'
    );
  end if;
end $$;
`);

  await client.query(`
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
`);
  console.log("OK: reconciliations + stripe_invoice_payments tables");

  await client.query(`
alter table public.reconciliations enable row level security;
alter table public.reconciliation_items enable row level security;
alter table public.stripe_invoice_payments enable row level security;
`);

  // Policies: create if missing
  await client.query(`
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reconciliations'
      and policyname = 'Staff full access reconciliations'
  ) then
    create policy "Staff full access reconciliations"
      on public.reconciliations for all
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
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reconciliation_items'
      and policyname = 'Staff full access reconciliation_items'
  ) then
    create policy "Staff full access reconciliation_items"
      on public.reconciliation_items for all
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
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stripe_invoice_payments'
      and policyname = 'Staff full access stripe_invoice_payments'
  ) then
    create policy "Staff full access stripe_invoice_payments"
      on public.stripe_invoice_payments for all
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
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stripe_invoice_payments'
      and policyname = 'Clients read own stripe_invoice_payments'
  ) then
    create policy "Clients read own stripe_invoice_payments"
      on public.stripe_invoice_payments for select
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
  end if;
end $$;
`);
  console.log("OK: RLS policies");

  // Verify enum
  const { rows: enums } = await client.query(`
    select e.enumlabel
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'account_type'
    order by e.enumsortorder
  `);
  console.log(
    "account_type values:",
    enums.map((r) => r.enumlabel).join(", ")
  );

  // Dry-run insert/delete stripe account
  const ins = await client.query(`
    insert into public.accounts (name, type, opening_balance, is_active)
    values ('__migration_probe_stripe__', 'stripe', 0, false)
    returning id
  `);
  const id = ins.rows[0].id;
  await client.query(`delete from public.accounts where id = $1`, [id]);
  console.log("OK: verified insert type=stripe works");

  console.log("\nMigration complete.");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  });
