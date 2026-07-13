"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/data/activity";
import { sendBrevoEmail } from "@/lib/email/brevo";
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailText,
} from "@/lib/email/invoice-template";
import type { ActionResult } from "@/lib/data/customers";
import type {
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

function computeTotals(lines: LineInput[], tax: number) {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.quantity * line.rate,
    0
  );
  return {
    subtotal,
    tax,
    total: subtotal + tax,
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
      amount: line.quantity * line.rate,
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

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { ok: true, id: invoice.id };
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

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
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

  if (error || !invoice) return { ok: false, error: error?.message || "Invoice not found" };

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

  revalidatePath("/transactions");
  return { ok: true, id: invoiceId };
}

export async function sendInvoiceEmail(
  invoiceId: string
): Promise<ActionResult & { message?: string }> {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    return { ok: false, error: error?.message || "Invoice not found" };
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

  if (!customer?.email) {
    return {
      ok: false,
      error: "Customer needs an email address before sending",
    };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const pdfUrl = `${origin}/invoice-pdf/${invoiceId}`;

  const htmlContent = buildInvoiceEmailHtml({
    invoice: invoice as Invoice,
    lines: (lines ?? []) as InvoiceLineItem[],
    customer: customer as Customer,
    company: (company as CompanySettings) ?? null,
    pdfUrl,
  });

  const textContent = buildInvoiceEmailText({
    invoice: invoice as Invoice,
    customer: customer as Customer,
    company: (company as CompanySettings) ?? null,
    pdfUrl,
  });

  const companyName =
    (company as CompanySettings | null)?.name || "Farrar Apps";

  const sent = await sendBrevoEmail({
    toEmail: customer.email,
    toName: customer.name,
    subject: `Invoice ${invoice.invoice_number} from ${companyName}`,
    htmlContent,
    textContent,
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
      to: customer.email,
      message_id: sent.messageId ?? null,
    },
  });

  await supabase.rpc("notify_staff", {
    p_title: `Invoice ${invoice.invoice_number} emailed`,
    p_body: `Sent to ${customer.email}`,
    p_href: `/invoices/${invoiceId}`,
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return {
    ok: true,
    id: invoiceId,
    message: `Invoice emailed to ${customer.email}`,
  };
}
