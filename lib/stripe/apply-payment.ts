import "server-only";
import pg from "pg";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/format";
import { expireOpenCheckoutSessionsAfterPaid } from "@/lib/stripe/expire-open-sessions";

type ApplyInput = {
  invoiceId: string;
  customerId: string;
  chargeAmount?: number;
  feeAmount?: number;
  amount?: number;
  currency: string;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  raw?: unknown;
};

function invoicePrincipal(_input: ApplyInput, invoiceTotal: number) {
  return Number(invoiceTotal) || 0;
}

function chargeTotal(input: ApplyInput, invoiceAmount: number) {
  return Number(input.chargeAmount) || Number(input.amount) || invoiceAmount;
}

function feeTotal(input: ApplyInput, charge: number, invoiceAmount: number) {
  const derived = Math.max(
    0,
    Math.round((charge - invoiceAmount) * 100) / 100
  );
  if (input.feeAmount != null && Number.isFinite(Number(input.feeAmount))) {
    const explicit = Math.max(0, Number(input.feeAmount));
    // Prefer explicit fee when > 0; if caller passed 0 but charge > principal,
    // recover fee so PDF/email match the card charge.
    if (explicit > 0) return explicit;
    if (derived > 0) return derived;
    return 0;
  }
  return derived;
}

async function postApplySideEffects(opts: {
  invoiceId: string;
  invoiceNumber: string;
  invoiceAmount: number;
  chargeAmount: number;
  feeAmount: number;
  paymentIntentId?: string | null;
}) {
  // Best-effort only — never block payment apply
  try {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString && !connectionString.includes("YOUR_PASSWORD")) {
      const client = new pg.Client({
        connectionString,
        ssl: { rejectUnauthorized: false },
      });
      try {
        await client.connect();
        await client.query(
          `insert into activity_logs (actor_id, action, entity_type, entity_id, meta)
           values (null, 'paid', 'invoice', $1, $2::jsonb)`,
          [
            opts.invoiceId,
            JSON.stringify({
              invoice_number: opts.invoiceNumber,
              amount: opts.invoiceAmount,
              charge_amount: opts.chargeAmount,
              fee_amount: opts.feeAmount,
              source: "stripe",
              payment_intent_id: opts.paymentIntentId ?? null,
            }),
          ]
        );
        const { rows: staff } = await client.query(
          `select id from profiles where role in ('owner', 'staff')`
        );
        const body =
          opts.feeAmount > 0
            ? `${formatCurrency(opts.invoiceAmount)} via Stripe (charged ${formatCurrency(opts.chargeAmount)})`
            : `${formatCurrency(opts.invoiceAmount)} via Stripe`;
        for (const s of staff) {
          await client.query(
            `insert into notifications (user_id, title, body, href)
             values ($1, $2, $3, $4)`,
            [
              s.id,
              `Invoice ${opts.invoiceNumber} paid`,
              body,
              `/finance/invoices/${opts.invoiceId}`,
            ]
          );
        }
      } finally {
        await client.end().catch(() => undefined);
      }
    } else {
      const supabase = createAdminClient();
      await supabase.from("activity_logs").insert({
        actor_id: null,
        action: "paid",
        entity_type: "invoice",
        entity_id: opts.invoiceId,
        meta: {
          invoice_number: opts.invoiceNumber,
          amount: opts.invoiceAmount,
          charge_amount: opts.chargeAmount,
          fee_amount: opts.feeAmount,
          source: "stripe",
          payment_intent_id: opts.paymentIntentId ?? null,
        },
      });
      const { data: staff } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["owner", "staff"]);
      if (staff?.length) {
        const body =
          opts.feeAmount > 0
            ? `${formatCurrency(opts.invoiceAmount)} via Stripe (charged ${formatCurrency(opts.chargeAmount)})`
            : `${formatCurrency(opts.invoiceAmount)} via Stripe`;
        await supabase.from("notifications").insert(
          staff.map((s) => ({
            user_id: s.id,
            title: `Invoice ${opts.invoiceNumber} paid`,
            body,
            href: `/finance/invoices/${opts.invoiceId}`,
          }))
        );
      }
    }
  } catch (e) {
    console.error(
      "postApplySideEffects",
      e instanceof Error ? e.message : e
    );
  }

  const paidAt = new Date().toISOString();

  // Customer payment receipt (invoice PDF + fee breakdown)
  try {
    const { sendPaymentReceiptEmail } = await import(
      "@/lib/email/send-payment-receipt"
    );
    const receipt = await sendPaymentReceiptEmail({
      invoiceId: opts.invoiceId,
      invoiceAmount: opts.invoiceAmount,
      feeAmount: opts.feeAmount,
      chargeAmount: opts.chargeAmount,
      paidAt,
    });
    if (!receipt.ok) {
      console.error("payment receipt email", receipt.error);
    }
  } catch (e) {
    console.error(
      "payment receipt email",
      e instanceof Error ? e.message : e
    );
  }

  // Staff notification (no attachments)
  try {
    const { sendStaffPaymentNotice } = await import(
      "@/lib/email/send-staff-payment-notice"
    );
    const notice = await sendStaffPaymentNotice({
      invoiceId: opts.invoiceId,
      invoiceAmount: opts.invoiceAmount,
      feeAmount: opts.feeAmount,
      chargeAmount: opts.chargeAmount,
      paidAt,
    });
    if (!notice.ok) {
      console.error("staff payment notice", notice.error);
    }
  } catch (e) {
    console.error(
      "staff payment notice",
      e instanceof Error ? e.message : e
    );
  }

  void expireOpenCheckoutSessionsAfterPaid(opts.invoiceId);
}

/**
 * Prefer direct Postgres (DATABASE_URL) for webhook writes.
 */
async function applyViaPg(
  input: ApplyInput
): Promise<
  | { ok: true; transactionId?: string; firstApply?: boolean }
  | { ok: false; error: string }
  | null
> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.includes("YOUR_PASSWORD")) {
    return null;
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query("begin");

    // Idempotency by Stripe ids
    if (input.paymentIntentId) {
      const { rows } = await client.query(
        `select id, transaction_id, status from stripe_invoice_payments
         where payment_intent_id = $1 limit 1`,
        [input.paymentIntentId]
      );
      if (rows[0]?.status === "succeeded" && rows[0].transaction_id) {
        await client.query("commit");
        return {
          ok: true,
          transactionId: rows[0].transaction_id,
          firstApply: false,
        };
      }
    }
    if (input.checkoutSessionId) {
      const { rows } = await client.query(
        `select id, transaction_id, status from stripe_invoice_payments
         where checkout_session_id = $1 limit 1`,
        [input.checkoutSessionId]
      );
      if (rows[0]?.status === "succeeded" && rows[0].transaction_id) {
        await client.query("commit");
        return {
          ok: true,
          transactionId: rows[0].transaction_id,
          firstApply: false,
        };
      }
    }

    // Lock invoice row to prevent concurrent double-apply
    const { rows: invRows } = await client.query(
      `select id, invoice_number, status, customer_id, project_id, total
       from invoices where id = $1 for update`,
      [input.invoiceId]
    );
    const invoice = invRows[0];
    if (!invoice) {
      await client.query("rollback");
      return { ok: false, error: "Invoice not found" };
    }

    if (
      input.customerId &&
      invoice.customer_id &&
      input.customerId !== invoice.customer_id
    ) {
      await client.query("rollback");
      return { ok: false, error: "Customer mismatch for invoice" };
    }

    // Already paid: attach this session as succeeded without second income
    if (invoice.status === "paid") {
      if (input.checkoutSessionId) {
        const invAmt = Number(invoice.total) || 0;
        const chg = chargeTotal(input, invAmt);
        await client.query(
          `insert into stripe_invoice_payments (
             invoice_id, customer_id, checkout_session_id, payment_intent_id,
             amount, charge_amount, fee_amount, currency, status, updated_at
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,'succeeded', now())
           on conflict (checkout_session_id) do update set
             payment_intent_id = coalesce(excluded.payment_intent_id, stripe_invoice_payments.payment_intent_id),
             status = 'succeeded',
             updated_at = now()`,
          [
            invoice.id,
            invoice.customer_id,
            input.checkoutSessionId,
            input.paymentIntentId || null,
            invAmt,
            chg,
            feeTotal(input, chg, invAmt),
            input.currency || "usd",
          ]
        );
      }
      await client.query("commit");
      void expireOpenCheckoutSessionsAfterPaid(invoice.id);
      return { ok: true, firstApply: false };
    }

    let { rows: acctRows } = await client.query(
      `select id from accounts
       where type = 'stripe' and is_active = true
       order by created_at asc limit 1`
    );
    if (!acctRows[0]) {
      const created = await client.query(
        `insert into accounts (name, type, opening_balance, is_active)
         values ('Stripe', 'stripe', 0, true)
         returning id`
      );
      acctRows = created.rows;
    }
    const stripeAccountId = acctRows[0]?.id;
    if (!stripeAccountId) {
      await client.query("rollback");
      return { ok: false, error: "Could not resolve Stripe clearing account" };
    }

    const { rows: catRows } = await client.query(
      `select id from categories where type = 'income' and name = 'Client Payment' limit 1`
    );
    const categoryId = catRows[0]?.id ?? null;

    const invoiceAmount = invoicePrincipal(input, Number(invoice.total));
    const chargeAmount = chargeTotal(input, invoiceAmount);
    const feeAmount = feeTotal(input, chargeAmount, invoiceAmount);

    // Conditional mark paid — only one winner
    const { rows: paidRows } = await client.query(
      `update invoices
       set status = 'paid', paid_at = now(), updated_at = now()
       where id = $1 and status in ('sent', 'overdue', 'draft')
       returning id`,
      [invoice.id]
    );
    if (!paidRows[0]) {
      await client.query("commit");
      return { ok: true, firstApply: false };
    }

    const { rows: txRows } = await client.query(
      `insert into transactions (
         type, amount, date, description, reference,
         account_id, category_id, customer_id, project_id, invoice_id
       ) values (
         'income', $1, $2::date, $3, $4,
         $5, $6, $7, $8, $9
       ) returning id`,
      [
        invoiceAmount,
        new Date().toISOString().slice(0, 10),
        `Stripe payment for ${invoice.invoice_number}`,
        input.paymentIntentId || input.checkoutSessionId || null,
        stripeAccountId,
        categoryId,
        invoice.customer_id,
        invoice.project_id,
        invoice.id,
      ]
    );
    const transactionId = txRows[0].id as string;

    // Always key payment log by checkout_session_id when present (pending row exists)
    if (input.checkoutSessionId) {
      await client.query(
        `insert into stripe_invoice_payments (
           invoice_id, customer_id, checkout_session_id, payment_intent_id,
           amount, charge_amount, fee_amount, currency, status, transaction_id, raw, updated_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,'succeeded',$9,$10::jsonb, now())
         on conflict (checkout_session_id) do update set
           amount = excluded.amount,
           charge_amount = excluded.charge_amount,
           fee_amount = excluded.fee_amount,
           payment_intent_id = coalesce(excluded.payment_intent_id, stripe_invoice_payments.payment_intent_id),
           status = 'succeeded',
           transaction_id = excluded.transaction_id,
           raw = excluded.raw,
           updated_at = now()`,
        [
          invoice.id,
          invoice.customer_id,
          input.checkoutSessionId,
          input.paymentIntentId || null,
          invoiceAmount,
          chargeAmount,
          feeAmount,
          input.currency || "usd",
          transactionId,
          input.raw ? JSON.stringify(input.raw) : null,
        ]
      );
    } else if (input.paymentIntentId) {
      await client.query(
        `insert into stripe_invoice_payments (
           invoice_id, customer_id, checkout_session_id, payment_intent_id,
           amount, charge_amount, fee_amount, currency, status, transaction_id, raw, updated_at
         ) values ($1,$2,null,$3,$4,$5,$6,$7,'succeeded',$8,$9::jsonb, now())
         on conflict (payment_intent_id) do update set
           amount = excluded.amount,
           charge_amount = excluded.charge_amount,
           fee_amount = excluded.fee_amount,
           status = 'succeeded',
           transaction_id = excluded.transaction_id,
           raw = excluded.raw,
           updated_at = now()`,
        [
          invoice.id,
          invoice.customer_id,
          input.paymentIntentId,
          invoiceAmount,
          chargeAmount,
          feeAmount,
          input.currency || "usd",
          transactionId,
          input.raw ? JSON.stringify(input.raw) : null,
        ]
      );
    }

    await client.query("commit");

    void postApplySideEffects({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      invoiceAmount,
      chargeAmount,
      feeAmount,
      paymentIntentId: input.paymentIntentId,
    });

    return { ok: true, transactionId, firstApply: true };
  } catch (e) {
    try {
      await client.query("rollback");
    } catch {
      /* ignore */
    }
    const message = e instanceof Error ? e.message : "DB apply failed";
    console.error("applyViaPg", message);
    return { ok: false, error: message };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function applyViaSupabase(
  input: ApplyInput
): Promise<
  | { ok: true; transactionId?: string; firstApply?: boolean }
  | { ok: false; error: string }
> {
  const supabase = createAdminClient();

  if (input.paymentIntentId) {
    const { data: existing } = await supabase
      .from("stripe_invoice_payments")
      .select("id, transaction_id, status")
      .eq("payment_intent_id", input.paymentIntentId)
      .maybeSingle();
    if (existing?.status === "succeeded" && existing.transaction_id) {
      return {
        ok: true,
        transactionId: existing.transaction_id,
        firstApply: false,
      };
    }
  }
  if (input.checkoutSessionId) {
    const { data: existing } = await supabase
      .from("stripe_invoice_payments")
      .select("id, transaction_id, status")
      .eq("checkout_session_id", input.checkoutSessionId)
      .maybeSingle();
    if (existing?.status === "succeeded" && existing.transaction_id) {
      return {
        ok: true,
        transactionId: existing.transaction_id,
        firstApply: false,
      };
    }
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, customer_id, project_id, total")
    .eq("id", input.invoiceId)
    .single();

  if (!invoice) return { ok: false, error: "Invoice not found" };
  if (
    input.customerId &&
    invoice.customer_id &&
    input.customerId !== invoice.customer_id
  ) {
    return { ok: false, error: "Customer mismatch for invoice" };
  }
  if (invoice.status === "paid") {
    return { ok: true, firstApply: false };
  }

  let { data: stripeAccount } = await supabase
    .from("accounts")
    .select("id")
    .eq("type", "stripe")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!stripeAccount) {
    const { data: created, error: createErr } = await supabase
      .from("accounts")
      .insert({
        name: "Stripe",
        type: "stripe",
        opening_balance: 0,
        is_active: true,
      })
      .select("id")
      .single();
    if (createErr) {
      return { ok: false, error: createErr.message };
    }
    stripeAccount = created;
  }

  if (!stripeAccount?.id) {
    return { ok: false, error: "Could not resolve Stripe clearing account" };
  }

  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("type", "income")
    .eq("name", "Client Payment")
    .maybeSingle();

  const invoiceAmount = invoicePrincipal(input, Number(invoice.total));
  const chargeAmount = chargeTotal(input, invoiceAmount);
  const feeAmount = feeTotal(input, chargeAmount, invoiceAmount);

  // Conditional paid transition
  const { data: claimed, error: claimErr } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", invoice.id)
    .in("status", ["sent", "overdue", "draft"])
    .select("id")
    .maybeSingle();

  if (claimErr) return { ok: false, error: claimErr.message };
  if (!claimed) {
    return { ok: true, firstApply: false };
  }

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      type: "income",
      amount: invoiceAmount,
      date: new Date().toISOString().slice(0, 10),
      description: `Stripe payment for ${invoice.invoice_number}`,
      reference: input.paymentIntentId || input.checkoutSessionId || null,
      account_id: stripeAccount.id,
      category_id: category?.id ?? null,
      customer_id: invoice.customer_id,
      project_id: invoice.project_id,
      invoice_id: invoice.id,
    })
    .select("id")
    .single();

  if (txError || !tx) {
    // Best-effort rollback of paid status if income failed
    await supabase
      .from("invoices")
      .update({ status: "sent", paid_at: null })
      .eq("id", invoice.id)
      .eq("status", "paid");
    return { ok: false, error: txError?.message || "Failed to record payment" };
  }

  const { error: logError } = await supabase
    .from("stripe_invoice_payments")
    .upsert(
      {
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        checkout_session_id: input.checkoutSessionId || null,
        payment_intent_id: input.paymentIntentId || null,
        amount: invoiceAmount,
        charge_amount: chargeAmount,
        fee_amount: feeAmount,
        currency: input.currency || "usd",
        status: "succeeded",
        transaction_id: tx.id,
        raw: input.raw ?? null,
        updated_at: new Date().toISOString(),
      },
      {
        // Prefer session id when present (matches pending row)
        onConflict: input.checkoutSessionId
          ? "checkout_session_id"
          : "payment_intent_id",
        ignoreDuplicates: false,
      }
    );

  if (logError) {
    console.error("stripe_invoice_payments upsert", logError.message);
  }

  void postApplySideEffects({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    invoiceAmount,
    chargeAmount,
    feeAmount,
    paymentIntentId: input.paymentIntentId,
  });

  return { ok: true, transactionId: tx.id, firstApply: true };
}

export async function applyStripeInvoicePayment(
  input: ApplyInput
): Promise<
  | { ok: true; transactionId?: string; firstApply?: boolean }
  | { ok: false; error: string }
> {
  const viaPg = await applyViaPg(input);
  if (viaPg) {
    // Connectivity-style failures: try Supabase if available
    if (
      !viaPg.ok &&
      /connect|ECONN|timeout|password|SSL|ENOTFOUND/i.test(viaPg.error)
    ) {
      try {
        return await applyViaSupabase(input);
      } catch {
        return viaPg;
      }
    }
    return viaPg;
  }

  try {
    return await applyViaSupabase(input);
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Payment apply failed (no DATABASE_URL and service role unavailable)",
    };
  }
}
