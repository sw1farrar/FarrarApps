"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/data/activity";
import { sendBrevoEmail } from "@/lib/email/brevo";
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailText,
} from "@/lib/email/invoice-template";
import { renderInvoicePdfBuffer } from "@/lib/pdf/render-invoice-pdf";
import { resolveEmailLogoSrc } from "@/lib/email/resolve-logo";
import type { ActionResult } from "@/lib/data/customers";
import type {
  Account,
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
} from "@/lib/types/database";

type LineInput = {
  description: string;
  quantity: number;
  rate: number;
};

function money(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function computeTotals(lines: LineInput[], tax: number) {
  const subtotal = money(
    lines.reduce((sum, line) => sum + line.quantity * line.rate, 0)
  );
  const taxAmount = money(tax);
  return {
    subtotal,
    tax: taxAmount,
    total: money(subtotal + taxAmount),
  };
}

async function nextInvoiceNumber(supabase: Awaited<ReturnType<typeof createClient>>) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);

  const last = data?.[0]?.invoice_number as string | undefined;
  const seq = last ? Number(last.split("-").pop()) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function createInvoice(input: {
  customer_id: string;
  project_id?: string | null;
  issue_date: string;
  due_date: string;
  notes?: string | null;
  tax?: number;
  lines: LineInput[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!input.customer_id) return { ok: false, error: "Customer is required" };
  if (!input.lines.length) return { ok: false, error: "Add at least one line item" };

  const totals = computeTotals(input.lines, input.tax ?? 0);
  const invoice_number = await nextInvoiceNumber(supabase);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      customer_id: input.customer_id,
      project_id: input.project_id || null,
      invoice_number,
      issue_date: input.issue_date,
      due_date: input.due_date,
      notes: input.notes || null,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      status: "draft",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const { error: lineError } = await supabase.from("invoice_line_items").insert(
    input.lines.map((line, index) => ({
      invoice_id: invoice.id,
      description: line.description,
      quantity: line.quantity,
      rate: line.rate,
      amount: money(line.quantity * line.rate),
      sort_order: index,
    }))
  );

  if (lineError) return { ok: false, error: lineError.message };

  await logActivity({
    action: "created",
    entity_type: "invoice",
    entity_id: invoice.id,
    meta: { invoice_number, total: totals.total },
  });

  revalidatePath("/finance/invoices");
  revalidatePath("/dashboard");
  return { ok: true, id: invoice.id };
}

export async function updateInvoice(
  id: string,
  input: {
    customer_id: string;
    project_id?: string | null;
    issue_date: string;
    due_date: string;
    notes?: string | null;
    tax?: number;
    lines: LineInput[];
  }
): Promise<ActionResult> {
  const supabase = await createClient();

  if (!input.customer_id) return { ok: false, error: "Customer is required" };
  if (!input.lines.length) return { ok: false, error: "Add at least one line item" };

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("invoice_number, status")
    .eq("id", id)
    .single();

  if (invoiceError || !invoice) {
    return { ok: false, error: invoiceError?.message || "Invoice not found" };
  }
  if (invoice.status !== "draft") {
    return { ok: false, error: "Only draft invoices can be edited" };
  }

  const totals = computeTotals(input.lines, input.tax ?? 0);
  const { error } = await supabase
    .from("invoices")
    .update({
      customer_id: input.customer_id,
      project_id: input.project_id || null,
      issue_date: input.issue_date,
      due_date: input.due_date,
      notes: input.notes || null,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
    })
    .eq("id", id)
    .eq("status", "draft");

  if (error) return { ok: false, error: error.message };

  const { error: deleteError } = await supabase
    .from("invoice_line_items")
    .delete()
    .eq("invoice_id", id);
  if (deleteError) return { ok: false, error: deleteError.message };

  const { error: lineError } = await supabase.from("invoice_line_items").insert(
    input.lines.map((line, index) => ({
      invoice_id: id,
      description: line.description,
      quantity: line.quantity,
      rate: line.rate,
      amount: money(line.quantity * line.rate),
      sort_order: index,
    }))
  );

  if (lineError) return { ok: false, error: lineError.message };

  await logActivity({
    action: "updated",
    entity_type: "invoice",
    entity_id: id,
    meta: { invoice_number: invoice.invoice_number, total: totals.total },
  });

  revalidatePath("/finance/invoices");
  revalidatePath(`/finance/invoices/${id}`);
  revalidatePath("/dashboard");
  return { ok: true, id };
}

export type InvoiceWorkbenchData = {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoUrl: string | null;
  accounts: Account[];
  /** Card fee lines when paid online with pass-through fee. */
  cardFee: import("@/lib/invoices/card-fee-display").InvoiceCardFeeDisplay | null;
};

export async function getInvoiceWorkbenchData(
  invoiceId: string
): Promise<
  | { ok: true; data: InvoiceWorkbenchData }
  | { ok: false; error: string }
> {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "id, customer_id, project_id, invoice_number, status, issue_date, due_date, notes, subtotal, tax, total, paid_at, created_by, created_at, updated_at, customers(id, name, email, company), projects(id, name)"
    )
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    return { ok: false, error: error?.message || "Invoice not found" };
  }

  const [
    { data: lines },
    { data: accounts },
    { data: customer },
    { data: company },
    { data: stripePay },
  ] = await Promise.all([
    supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order"),
    supabase
      .from("accounts")
      .select("*")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("customers")
      .select("*")
      .eq("id", invoice.customer_id)
      .maybeSingle(),
    supabase.from("company_settings").select("*").limit(1).maybeSingle(),
    supabase
      .from("stripe_invoice_payments")
      .select("amount, charge_amount, fee_amount, status")
      .eq("invoice_id", invoiceId)
      .eq("status", "succeeded")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const typedCompany = (company as CompanySettings | null) ?? null;
  const typedInvoice = invoice as unknown as Invoice;
  const { data: logo } = typedCompany?.logo_path
    ? await supabase.storage
        .from("logos")
        .createSignedUrl(typedCompany.logo_path, 60 * 10)
    : { data: null };

  const { cardFeeDisplayFromStripeRow } = await import(
    "@/lib/invoices/card-fee-display"
  );
  const cardFee = cardFeeDisplayFromStripeRow(
    Number(typedInvoice.total),
    typedInvoice.paid_at,
    stripePay
  );

  return {
    ok: true,
    data: {
      invoice: typedInvoice,
      lines: (lines ?? []) as InvoiceLineItem[],
      customer: (customer as Customer | null) ?? null,
      company: typedCompany,
      logoUrl: logo?.signedUrl ?? null,
      accounts: (accounts ?? []) as Account[],
      cardFee,
    },
  };
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: invoice, error: loadError } = await supabase
    .from("invoices")
    .select("id, status, invoice_number")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !invoice) {
    return { ok: false, error: loadError?.message || "Invoice not found" };
  }
  if (invoice.status === "paid") {
    return { ok: false, error: "Paid invoices cannot be deleted" };
  }

  const { count: paymentCount, error: payError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", id)
    .eq("type", "income");

  if (payError) return { ok: false, error: payError.message };
  if ((paymentCount ?? 0) > 0) {
    return {
      ok: false,
      error: "This invoice has payment transactions recorded and cannot be deleted",
    };
  }

  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "deleted",
    entity_type: "invoice",
    entity_id: id,
    meta: { invoice_number: invoice.invoice_number },
  });

  revalidatePath("/finance/invoices");
  revalidatePath(`/finance/invoices/${id}`);
  revalidatePath("/finance/ar", "layout");
  revalidatePath("/dashboard");
  return { ok: true, id };
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "paid") patch.paid_at = new Date().toISOString();
  if (status !== "paid") patch.paid_at = null;

  const { error } = await supabase.from("invoices").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    action: "status_changed",
    entity_type: "invoice",
    entity_id: id,
    meta: { status },
  });

  revalidatePath("/finance/invoices");
  revalidatePath(`/finance/invoices/${id}`);
  revalidatePath("/finance/ar", "layout");
  revalidatePath("/dashboard");
  return { ok: true, id };
}

export async function recordInvoicePayment(
  invoiceId: string,
  accountId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    return { ok: false, error: error?.message || "Invoice not found" };
  }

  if (invoice.status === "paid") {
    return { ok: false, error: "Invoice is already paid" };
  }
  if (invoice.status === "draft") {
    return { ok: false, error: "Mark the invoice as sent before recording payment" };
  }

  // Block double-book with Stripe
  const { data: stripePaid } = await supabase
    .from("stripe_invoice_payments")
    .select("id, status")
    .eq("invoice_id", invoiceId)
    .eq("status", "succeeded")
    .limit(1)
    .maybeSingle();
  if (stripePaid) {
    return {
      ok: false,
      error:
        "This invoice already has a Stripe payment. Refresh the page — it should show paid.",
    };
  }

  const { data: stripePending } = await supabase
    .from("stripe_invoice_payments")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (stripePending) {
    return {
      ok: false,
      error:
        "A Stripe checkout is in progress for this invoice. Wait for it to finish or expire before recording a manual payment.",
    };
  }

  // Existing income already linked?
  const { count: existingIncome } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoiceId)
    .eq("type", "income");
  if ((existingIncome ?? 0) > 0) {
    return {
      ok: false,
      error: "An income transaction is already linked to this invoice",
    };
  }

  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("type", "income")
    .eq("name", "Client Payment")
    .maybeSingle();

  const { error: txError } = await supabase.from("transactions").insert({
    type: "income",
    amount: invoice.total,
    date: new Date().toISOString().slice(0, 10),
    description: `Payment for ${invoice.invoice_number}`,
    account_id: accountId,
    category_id: category?.id ?? null,
    customer_id: invoice.customer_id,
    project_id: invoice.project_id,
    invoice_id: invoice.id,
    created_by: user?.id ?? null,
  });

  if (txError) return { ok: false, error: txError.message };

  const statusResult = await updateInvoiceStatus(invoiceId, "paid");
  if (!statusResult.ok) return statusResult;

  // Revoke guest pay links so old emails cannot charge again
  await supabase
    .from("invoice_payment_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("invoice_id", invoiceId)
    .is("revoked_at", null);

  revalidatePath("/finance/transactions");
  revalidatePath(`/finance/accounts/${accountId}`);
  revalidatePath("/finance/ar", "layout");
  return { ok: true, id: invoiceId };
}

export async function sendInvoiceEmail(input: {
  invoiceId: string;
  toEmail?: string;
  message?: string;
}): Promise<ActionResult & { message?: string }> {
  const { invoiceId, toEmail, message } = input;
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    return { ok: false, error: error?.message || "Invoice not found" };
  }

  // Paid invoices must use the receipt path (PDF includes card fee when charged)
  if (invoice.status === "paid") {
    return resendPaymentReceipt({ invoiceId, toEmail });
  }

  const [{ data: customer }, { data: lines }, { data: company }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .eq("id", invoice.customer_id)
        .single(),
      supabase
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("sort_order"),
      supabase.from("company_settings").select("*").limit(1).maybeSingle(),
    ]);

  if (!customer?.email && !toEmail) {
    return {
      ok: false,
      error: "Customer needs an email address before sending",
    };
  }

  const recipientEmail = (toEmail || customer?.email || "").trim();
  if (!recipientEmail) {
    return { ok: false, error: "Enter a recipient email address" };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const typedCompany = (company as CompanySettings | null) ?? null;
  const { data: logo } = typedCompany?.logo_path
    ? await supabase.storage
        .from("logos")
        .createSignedUrl(typedCompany.logo_path, 60 * 10)
    : { data: null };
  const logoSrc = logo?.signedUrl || `${origin}/farrar_apps_logo.png`;
  // Email clients cannot load private/short-lived signed storage URLs, so embed
  // the logo as a data URI. The PDF still uses logoSrc above (embedded at render).
  const emailLogoSrc = await resolveEmailLogoSrc(
    supabase,
    typedCompany?.logo_path
  );

  const { createInvoicePaymentLink } = await import(
    "@/lib/invoices/payment-link"
  );
  let payUrl: string | null = null;
  let payLinkError: string | undefined;
  if (invoice.status !== "paid" && Number(invoice.total) > 0) {
    const link = await createInvoicePaymentLink(invoiceId);
    if (link.ok) payUrl = link.url;
    else payLinkError = link.error;
  }

  const pdfBuffer = await renderInvoicePdfBuffer({
    invoice: invoice as Invoice,
    lines: (lines ?? []) as InvoiceLineItem[],
    customer: customer as Customer,
    company: typedCompany,
    logoSrc,
  });

  const htmlContent = buildInvoiceEmailHtml({
    invoice: invoice as Invoice,
    lines: (lines ?? []) as InvoiceLineItem[],
    customer: customer as Customer,
    company: typedCompany,
    payUrl,
    message,
    logoUrl: emailLogoSrc || null,
  });

  const textContent = buildInvoiceEmailText({
    invoice: invoice as Invoice,
    customer: customer as Customer,
    company: typedCompany,
    payUrl,
    message,
  });

  const companyName = typedCompany?.name || "Farrar Apps";

  const sent = await sendBrevoEmail({
    toEmail: recipientEmail,
    toName: customer?.name,
    subject: `Invoice ${invoice.invoice_number} from ${companyName}`,
    htmlContent,
    textContent,
    attachments: [
      {
        name: `${invoice.invoice_number}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });

  if (!sent.ok) return { ok: false, error: sent.error };

  if (invoice.status === "draft") {
    await updateInvoiceStatus(invoiceId, "sent");
  }

  await logActivity({
    action: "emailed",
    entity_type: "invoice",
    entity_id: invoiceId,
    meta: {
      to: recipientEmail,
      message_id: sent.messageId ?? null,
      pay_link: Boolean(payUrl),
      pay_link_error: payLinkError ?? null,
    },
  });

  await supabase.rpc("notify_staff", {
    p_title: `Invoice ${invoice.invoice_number} emailed`,
    p_body: payUrl
      ? `Sent to ${recipientEmail} with pay link`
      : `Sent to ${recipientEmail} (no pay link${payLinkError ? `: ${payLinkError}` : ""})`,
    p_href: `/finance/invoices/${invoiceId}`,
  });

  revalidatePath(`/finance/invoices/${invoiceId}`);
  revalidatePath("/finance/invoices");

  if (!payUrl && invoice.status !== "paid" && Number(invoice.total) > 0) {
    return {
      ok: true,
      id: invoiceId,
      message: `Invoice emailed to ${recipientEmail}, but pay link failed${
        payLinkError ? ` (${payLinkError})` : ""
      }. PDF was attached — re-send after fixing the issue.`,
    };
  }

  return {
    ok: true,
    id: invoiceId,
    message: `Invoice emailed to ${recipientEmail}`,
  };
}

export type PaymentReceiptContext = {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoUrl: string | null;
  invoiceAmount: number;
  feeAmount: number;
  chargeAmount: number;
  paidAt: string | null;
  /** True when amounts came from a Stripe payment record. */
  fromStripe: boolean;
  cardFee: import("@/lib/invoices/card-fee-display").InvoiceCardFeeDisplay | null;
};

/**
 * Load paid-invoice receipt amounts (invoice principal + card fee + total charged).
 * Prefers stripe_invoice_payments; offline paid invoices use total with $0 fee.
 */
export async function getPaymentReceiptContext(
  invoiceId: string
): Promise<
  { ok: true; data: PaymentReceiptContext } | { ok: false; error: string }
> {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    return { ok: false, error: error?.message || "Invoice not found" };
  }
  if (invoice.status !== "paid") {
    return { ok: false, error: "Invoice is not paid — send an invoice email instead" };
  }

  const [
    { data: customer },
    { data: lines },
    { data: company },
    { data: stripePay },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("id", invoice.customer_id)
      .maybeSingle(),
    supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order"),
    supabase.from("company_settings").select("*").limit(1).maybeSingle(),
    supabase
      .from("stripe_invoice_payments")
      .select("amount, charge_amount, fee_amount, status, updated_at")
      .eq("invoice_id", invoiceId)
      .eq("status", "succeeded")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const typedCompany = (company as CompanySettings | null) ?? null;
  const {
    resolveCardFeeAmounts,
    cardFeeDisplayFromPayment,
  } = await import("@/lib/invoices/card-fee-display");

  const resolved = resolveCardFeeAmounts({
    invoiceTotal: Number(invoice.total),
    amount: stripePay?.amount,
    feeAmount: stripePay?.fee_amount,
    chargeAmount: stripePay?.charge_amount,
  });

  const { data: logo } = typedCompany?.logo_path
    ? await supabase.storage
        .from("logos")
        .createSignedUrl(typedCompany.logo_path, 60 * 10)
    : { data: null };

  const cardFee = cardFeeDisplayFromPayment({
    invoiceTotal: Number(invoice.total),
    paidAt: invoice.paid_at,
    amount: resolved.invoiceAmount,
    feeAmount: resolved.feeAmount,
    chargeAmount: resolved.chargeAmount,
  });

  return {
    ok: true,
    data: {
      invoice: invoice as Invoice,
      lines: (lines ?? []) as InvoiceLineItem[],
      customer: (customer as Customer | null) ?? null,
      company: typedCompany,
      logoUrl: logo?.signedUrl ?? null,
      invoiceAmount: resolved.invoiceAmount,
      feeAmount: resolved.feeAmount,
      chargeAmount: resolved.chargeAmount,
      paidAt: invoice.paid_at ?? null,
      fromStripe: Boolean(stripePay),
      cardFee,
    },
  };
}

/** Resend payment receipt (with card fee line when paid online). */
export async function resendPaymentReceipt(input: {
  invoiceId: string;
  toEmail?: string;
}): Promise<ActionResult & { message?: string }> {
  const ctx = await getPaymentReceiptContext(input.invoiceId);
  if (!ctx.ok) return ctx;

  const recipient = (
    input.toEmail ||
    ctx.data.customer?.email ||
    ""
  ).trim();
  if (!recipient) {
    return { ok: false, error: "Enter a recipient email address" };
  }

  const { sendPaymentReceiptEmail } = await import(
    "@/lib/email/send-payment-receipt"
  );
  const sent = await sendPaymentReceiptEmail({
    invoiceId: input.invoiceId,
    invoiceAmount: ctx.data.invoiceAmount,
    feeAmount: ctx.data.feeAmount,
    chargeAmount: ctx.data.chargeAmount,
    paidAt: ctx.data.paidAt,
    toEmail: recipient,
  });

  if (!sent.ok) return { ok: false, error: sent.error };

  await logActivity({
    action: "receipt_emailed",
    entity_type: "invoice",
    entity_id: input.invoiceId,
    meta: {
      to: recipient,
      invoice_amount: ctx.data.invoiceAmount,
      fee_amount: ctx.data.feeAmount,
      charge_amount: ctx.data.chargeAmount,
      from_stripe: ctx.data.fromStripe,
      message_id: sent.messageId ?? null,
    },
  });

  revalidatePath(`/finance/invoices/${input.invoiceId}`);
  revalidatePath("/finance/invoices");

  return {
    ok: true,
    id: input.invoiceId,
    message: `Payment receipt emailed to ${recipient}`,
  };
}
