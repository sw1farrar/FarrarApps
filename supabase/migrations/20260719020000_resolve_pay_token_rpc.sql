-- Public guest pay resolve without requiring service_role in the app.
-- Token hash is looked up under security definer; raw token never stored.

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
    return null;
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
    return jsonb_build_object('error', 'revoked');
  end if;

  if v_link.expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;

  select * into v_invoice from public.invoices where id = v_link.invoice_id;
  select * into v_customer from public.customers where id = v_link.customer_id;
  select * into v_company from public.company_settings order by created_at asc limit 1;

  if v_invoice.id is null or v_customer.id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  select coalesce(jsonb_agg(to_jsonb(li) order by li.sort_order), '[]'::jsonb)
  into v_lines
  from public.invoice_line_items li
  where li.invoice_id = v_invoice.id;

  update public.invoice_payment_links
  set last_used_at = now()
  where id = v_link.id;

  return jsonb_build_object(
    'link_id', v_link.id,
    'invoice', to_jsonb(v_invoice),
    'customer', to_jsonb(v_customer),
    'lines', v_lines,
    'company', case when v_company.id is null then null else to_jsonb(v_company) end
  );
end;
$$;

revoke all on function public.resolve_invoice_pay_token(text) from public;
grant execute on function public.resolve_invoice_pay_token(text) to anon, authenticated;

-- Allow guest checkout to log pending payments without service role
create or replace function public.upsert_stripe_checkout_pending(
  p_invoice_id uuid,
  p_customer_id uuid,
  p_checkout_session_id text,
  p_amount numeric,
  p_charge_amount numeric,
  p_fee_amount numeric,
  p_currency text default 'usd'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only if a valid non-expired payment link exists for this invoice
  if not exists (
    select 1
    from public.invoice_payment_links l
    where l.invoice_id = p_invoice_id
      and l.customer_id = p_customer_id
      and l.revoked_at is null
      and l.expires_at > now()
  ) then
    raise exception 'No active payment link for invoice';
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
    p_invoice_id,
    p_customer_id,
    p_checkout_session_id,
    p_amount,
    p_charge_amount,
    p_fee_amount,
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
    status = 'pending',
    updated_at = now();
end;
$$;

revoke all on function public.upsert_stripe_checkout_pending(uuid, uuid, text, numeric, numeric, numeric, text) from public;
grant execute on function public.upsert_stripe_checkout_pending(uuid, uuid, text, numeric, numeric, numeric, text) to anon, authenticated;
