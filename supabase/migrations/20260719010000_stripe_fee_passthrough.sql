-- Card fee pass-through settings + audit columns on Stripe payment log

alter table public.company_settings
  add column if not exists stripe_fee_percent numeric not null default 2.9,
  add column if not exists stripe_fee_fixed numeric not null default 0.30;

comment on column public.company_settings.stripe_fee_percent is
  'Card fee percent points for pass-through gross-up (e.g. 2.9 = 2.9%)';
comment on column public.company_settings.stripe_fee_fixed is
  'Fixed card fee in major currency units (e.g. 0.30 USD)';

alter table public.stripe_invoice_payments
  add column if not exists charge_amount numeric,
  add column if not exists fee_amount numeric;

comment on column public.stripe_invoice_payments.amount is
  'Invoice principal applied (income amount)';
comment on column public.stripe_invoice_payments.charge_amount is
  'Total charged to customer (Checkout amount_total)';
comment on column public.stripe_invoice_payments.fee_amount is
  'Card processing fee line (charge - invoice principal)';
