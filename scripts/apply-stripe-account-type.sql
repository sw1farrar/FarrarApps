-- Minimal fix: allow accounts.type = 'stripe'
-- Paste into Supabase Dashboard → SQL Editor → Run
-- (Also covered by migration 20260716010000_finance_reconcile_stripe.sql)

-- 1) Add enum value if missing
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

-- 2) Commit happens automatically between statements in SQL Editor.
--    Re-run the constraint in a second run if needed after ADD VALUE.

alter table public.accounts drop constraint if exists accounts_supported_types_check;

alter table public.accounts
  add constraint accounts_supported_types_check
  check (type::text in ('checking', 'credit_card', 'stripe'));
