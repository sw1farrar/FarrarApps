-- Allow draft invoice shells without a customer yet.
-- Send / pay / status promotion still enforce a customer in app code.

alter table public.invoices
  alter column customer_id drop not null;
