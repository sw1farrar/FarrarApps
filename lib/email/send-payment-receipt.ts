import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBrevoEmail } from "@/lib/email/brevo";
import {
  buildPaymentReceiptEmailHtml,
  buildPaymentReceiptEmailText,
} from "@/lib/email/payment-receipt-template";
import { resolveEmailLogoSrc } from "@/lib/email/resolve-logo";
import { renderInvoicePdfBuffer } from "@/lib/pdf/render-invoice-pdf";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

/**
 * Email the customer a paid receipt (invoice PDF + fee breakdown).
 * Best-effort; does not throw.
 */
export async function sendPaymentReceiptEmail(input: {
  invoiceId: string;
  invoiceAmount: number;
  feeAmount: number;
  chargeAmount: number;
  paidAt?: string | null;
  /** Override recipient (defaults to customer email). */
  toEmail?: string | null;
}): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  try {
    const supabase = createAdminClient();

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", input.invoiceId)
      .single();

    if (invErr || !invoice) {
      return { ok: false, error: invErr?.message || "Invoice not found" };
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
          .eq("invoice_id", input.invoiceId)
          .order("sort_order"),
        supabase.from("company_settings").select("*").limit(1).maybeSingle(),
      ]);

    const recipientEmail = (input.toEmail || customer?.email || "").trim();
    if (!recipientEmail) {
      return { ok: false, error: "Customer has no email address" };
    }

    const typedCompany = (company as CompanySettings | null) ?? null;
    const typedInvoice = invoice as Invoice;
    const typedLines = (lines ?? []) as InvoiceLineItem[];
    // Safe customer for templates when row is missing but toEmail override is set
    const typedCustomer =
      (customer as Customer | null) ??
      ({
        id: invoice.customer_id as string,
        name: recipientEmail.split("@")[0] || "Customer",
        email: recipientEmail,
        company: null,
        phone: null,
        address: null,
        city: null,
        state: null,
        zip: null,
        notes: null,
        portal_user_id: null,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } satisfies Customer);

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";
    const { data: logo } = typedCompany?.logo_path
      ? await supabase.storage
          .from("logos")
          .createSignedUrl(typedCompany.logo_path, 60 * 10)
      : { data: null };
    const logoSrc = logo?.signedUrl || `${origin}/farrar_apps_logo.png`;
    const emailLogoSrc = await resolveEmailLogoSrc(
      supabase,
      typedCompany?.logo_path
    );

    const {
      resolveCardFeeAmounts,
      cardFeeDisplayFromPayment,
    } = await import("@/lib/invoices/card-fee-display");
    const resolved = resolveCardFeeAmounts({
      invoiceTotal: Number(typedInvoice.total),
      amount: input.invoiceAmount,
      feeAmount: input.feeAmount,
      chargeAmount: input.chargeAmount,
    });
    const cardFee = cardFeeDisplayFromPayment({
      invoiceTotal: Number(typedInvoice.total),
      paidAt: input.paidAt || typedInvoice.paid_at,
      amount: resolved.invoiceAmount,
      feeAmount: resolved.feeAmount,
      chargeAmount: resolved.chargeAmount,
    });

    const pdfBuffer = await renderInvoicePdfBuffer({
      invoice: typedInvoice,
      lines: typedLines,
      customer: typedCustomer,
      company: typedCompany,
      logoSrc,
      cardFee,
      includeCardRemittance: true,
    });

    const htmlContent = buildPaymentReceiptEmailHtml({
      invoice: typedInvoice,
      lines: typedLines,
      customer: typedCustomer,
      company: typedCompany,
      invoiceAmount: resolved.invoiceAmount,
      feeAmount: resolved.feeAmount,
      chargeAmount: resolved.chargeAmount,
      logoUrl: emailLogoSrc || null,
      paidAt: input.paidAt || typedInvoice.paid_at,
    });

    const textContent = buildPaymentReceiptEmailText({
      invoice: typedInvoice,
      customer: typedCustomer,
      company: typedCompany,
      invoiceAmount: resolved.invoiceAmount,
      feeAmount: resolved.feeAmount,
      chargeAmount: resolved.chargeAmount,
    });

    const companyName = typedCompany?.name || "Farrar Apps";
    const sent = await sendBrevoEmail({
      toEmail: recipientEmail,
      toName: customer?.name,
      subject: `Payment receipt · ${typedInvoice.invoice_number} · ${companyName}`,
      htmlContent,
      textContent,
      attachments: [
        {
          name: `${typedInvoice.invoice_number}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });

    if (!sent.ok) return { ok: false, error: sent.error };
    return { ok: true, messageId: sent.messageId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Receipt email failed",
    };
  }
}
