alter type public.transaction_type add value if not exists 'transfer';

alter table public.transactions
  add column if not exists reference text,
  add column if not exists transfer_account_id uuid
    references public.accounts (id) on delete restrict,
  add column if not exists reconciled_at timestamptz,
  add column if not exists reconciled_by uuid
    references auth.users (id) on delete set null;

alter table public.transactions
  add constraint transactions_transfer_accounts_check
  check (
    (
      type::text = 'transfer'
      and transfer_account_id is not null
      and transfer_account_id <> account_id
      and category_id is null
    )
    or (
      type::text <> 'transfer'
      and transfer_account_id is null
    )
  );

alter table public.accounts
  add constraint accounts_supported_types_check
  check (type::text in ('checking', 'credit_card')) not valid;

create index if not exists transactions_account_date_idx
  on public.transactions (account_id, date desc);

create index if not exists transactions_transfer_account_date_idx
  on public.transactions (transfer_account_id, date desc)
  where transfer_account_id is not null;

create index if not exists transactions_unreconciled_idx
  on public.transactions (date desc)
  where reconciled_at is null;
