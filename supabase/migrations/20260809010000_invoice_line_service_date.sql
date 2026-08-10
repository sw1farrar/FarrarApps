-- Optional service/work date on invoice line items.
-- When null, UIs and PDFs omit the date entirely.

alter table public.invoice_line_items
  add column if not exists service_date date;
