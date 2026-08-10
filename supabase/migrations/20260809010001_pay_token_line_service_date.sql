-- Include optional line service_date in guest pay token payload.

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
        'service_date', li.service_date,
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

revoke all on function public.resolve_invoice_pay_token(text) from public;
grant execute on function public.resolve_invoice_pay_token(text) to anon, authenticated;
