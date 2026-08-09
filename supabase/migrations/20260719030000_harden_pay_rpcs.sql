-- Harden guest pay RPCs: whitelist payload, token-bound pending upsert, never demote succeeded.

create or replace function public.resolve_invoice_pay_token(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.invoice_payment_links%rowtype;
  v_invoice public.invoices%rowtype;
  v_customer public.customers%rowtype;
  v_company public.company_settings%rowtype;
  v_lines jsonb;
begin
  if p_token_hash is null or length(p_token_hash) < 32 then
    return jsonb_build_object('error', 'invalid');
  end if;

  select *
  into v_link
  from public.invoice_payment_links
  where token_hash = p_token_hash
  limit 1;

  if not found then
    return jsonb_build_object('error', 'invalid');
  end if;

  if v_link.revoked_at is not null then
    return jsonb_build_object('error', 'invalid');
  end if;

  if v_link.expires_at < now() then
    return jsonb_build_object('error', 'invalid');
  end if;

  select * into v_invoice from public.invoices where id = v_link.invoice_id;
  select * into v_customer from public.customers where id = v_link.customer_id;
  select * into v_company from public.company_settings order by created_at asc limit 1;

  if v_invoice.id is null or v_customer.id is null then
    return jsonb_build_object('error', 'invalid');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', li.id,
        'description', li.description,
        'quantity', li.quantity,
        'rate', li.rate,
        'amount', li.amount,
        'sort_order', li.sort_order
      )
      order by li.sort_order
    ),
    '[]'::jsonb
  )
  into v_lines
  from public.invoice_line_items li
  where li.invoice_id = v_invoice.id;

  -- Throttle last_used_at updates (at most every 5 minutes)
  update public.invoice_payment_links
  set last_used_at = now()
  where id = v_link.id
    and (last_used_at is null or last_used_at < now() - interval '5 minutes');

  return jsonb_build_object(
    'link_id', v_link.id,
    'invoice', jsonb_build_object(
      'id', v_invoice.id,
      'customer_id', v_invoice.customer_id,
      'project_id', v_invoice.project_id,
      'invoice_number', v_invoice.invoice_number,
      'status', v_invoice.status,
      'issue_date', v_invoice.issue_date,
      'due_date', v_invoice.due_date,
      'notes', v_invoice.notes,
      'subtotal', v_invoice.subtotal,
      'tax', v_invoice.tax,
      'total', v_invoice.total
    ),
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'name', v_customer.name,
      'email', v_customer.email,
      'company', v_customer.company
    ),
    'lines', v_lines,
    'company', case
      when v_company.id is null then null
      else jsonb_build_object(
        'id', v_company.id,
        'name', v_company.name,
        'email', v_company.email,
        'phone', v_company.phone,
        'logo_path', v_company.logo_path,
        'invoice_terms', v_company.invoice_terms,
        'stripe_fee_percent', v_company.stripe_fee_percent,
        'stripe_fee_fixed', v_company.stripe_fee_fixed
      )
    end
  );
end;
$$;

-- Token-bound pending upsert; never demotes succeeded; amounts from invoice
drop function if exists public.upsert_stripe_checkout_pending(uuid, uuid, text, numeric, numeric, numeric, text);
drop function if exists public.upsert_stripe_checkout_pending(text, text, text);

create or replace function public.upsert_stripe_checkout_pending(
  p_token_hash text,
  p_checkout_session_id text,
  p_currency text default 'usd'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.invoice_payment_links%rowtype;
  v_invoice public.invoices%rowtype;
  v_fee_percent numeric;
  v_fee_fixed numeric;
  v_invoice_amount numeric;
  v_charge numeric;
  v_fee numeric;
begin
  if p_token_hash is null or length(p_token_hash) < 32 then
    raise exception 'Invalid token';
  end if;
  if p_checkout_session_id is null
     or p_checkout_session_id not like 'cs_%' then
    raise exception 'Invalid checkout session';
  end if;

  select *
  into v_link
  from public.invoice_payment_links
  where token_hash = p_token_hash
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if not found then
    raise exception 'No active payment link';
  end if;

  select * into v_invoice from public.invoices where id = v_link.invoice_id;
  if v_invoice.id is null then
    raise exception 'Invoice not found';
  end if;
  if v_invoice.status = 'paid' then
    raise exception 'Invoice already paid';
  end if;
  if v_invoice.status = 'draft' or coalesce(v_invoice.total, 0) <= 0 then
    raise exception 'Invoice not payable';
  end if;

  select
    coalesce(stripe_fee_percent, 2.9),
    coalesce(stripe_fee_fixed, 0.30)
  into v_fee_percent, v_fee_fixed
  from public.company_settings
  order by created_at asc
  limit 1;

  v_invoice_amount := round(v_invoice.total::numeric, 2);
  if v_fee_percent >= 100 or v_fee_percent < 0 then
    v_fee_percent := 2.9;
  end if;
  if v_fee_fixed < 0 then
    v_fee_fixed := 0.30;
  end if;

  if v_fee_percent = 0 and v_fee_fixed = 0 then
    v_charge := v_invoice_amount;
    v_fee := 0;
  else
    v_charge := round((v_invoice_amount + v_fee_fixed) / (1 - (v_fee_percent / 100.0)), 2);
    if v_charge < v_invoice_amount then
      v_charge := v_invoice_amount;
    end if;
    v_fee := round(v_charge - v_invoice_amount, 2);
  end if;

  insert into public.stripe_invoice_payments as s (
    invoice_id,
    customer_id,
    checkout_session_id,
    amount,
    charge_amount,
    fee_amount,
    currency,
    status,
    updated_at
  ) values (
    v_invoice.id,
    v_link.customer_id,
    p_checkout_session_id,
    v_invoice_amount,
    v_charge,
    v_fee,
    coalesce(p_currency, 'usd'),
    'pending',
    now()
  )
  on conflict (checkout_session_id) do update
  set
    amount = excluded.amount,
    charge_amount = excluded.charge_amount,
    fee_amount = excluded.fee_amount,
    currency = excluded.currency,
    updated_at = now()
  where s.status is distinct from 'succeeded'
    and s.status is distinct from 'failed';
end;
$$;

revoke all on function public.resolve_invoice_pay_token(text) from public;
grant execute on function public.resolve_invoice_pay_token(text) to anon, authenticated;

revoke all on function public.upsert_stripe_checkout_pending(text, text, text) from public;
grant execute on function public.upsert_stripe_checkout_pending(text, text, text) to anon, authenticated;

-- Ensure only one active link per invoice before unique index
with ranked as (
  select id,
         row_number() over (
           partition by invoice_id
           order by created_at desc
         ) as rn
  from public.invoice_payment_links
  where revoked_at is null
)
update public.invoice_payment_links l
set revoked_at = now()
from ranked r
where l.id = r.id and r.rn > 1;

create unique index if not exists invoice_payment_links_one_active_idx
  on public.invoice_payment_links (invoice_id)
  where revoked_at is null;
