import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { formatCurrency, formatDate } from "@/lib/format";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Notify all owner/staff by email when an online payment succeeds.
 * No attachments — text details only. Best-effort.
 */
export async function sendStaffPaymentNotice(input: {
  invoiceId: string;
  invoiceAmount: number;
  feeAmount: number;
  chargeAmount: number;
  paidAt?: string | null;
}): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  try {
    const supabase = createAdminClient();

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, customer_id, total, paid_at")
      .eq("id", input.invoiceId)
      .single();

    if (!invoice) {
      return { ok: false, error: "Invoice not found" };
    }

    const [{ data: customer }, { data: staff }] = await Promise.all([
      supabase
        .from("customers")
        .select("id, name, company, email")
        .eq("id", invoice.customer_id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .in("role", ["owner", "staff"]),
    ]);

    const recipients = (staff ?? []).filter(
      (s) => s.email && String(s.email).includes("@")
    );
    if (!recipients.length) {
      return { ok: false, error: "No staff emails found" };
    }

    const invoiceNumber = invoice.invoice_number as string;
    const customerName =
      customer?.name || customer?.company || "Customer";
    const customerCompany = customer?.company
      ? ` · ${customer.company}`
      : "";
    const paidLabel = formatDate(
      input.paidAt || invoice.paid_at || new Date().toISOString()
    );
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";
    const href = `${origin}/finance/invoices/${invoice.id}`;

    const feeLine =
      input.feeAmount > 0
        ? `Card fee (paid to Stripe, not received): ${formatCurrency(input.feeAmount)}\n`
        : "";

    const textBody = [
      `Online payment received`,
      "",
      `Invoice: ${invoiceNumber}`,
      `Customer: ${customerName}${customerCompany}`,
      customer?.email ? `Customer email: ${customer.email}` : null,
      `Paid: ${paidLabel}`,
      "",
      `Amount received: ${formatCurrency(input.invoiceAmount)}`,
      feeLine.trimEnd() || null,
      input.feeAmount > 0
        ? `Customer card charged: ${formatCurrency(input.chargeAmount)} (pass-through; not company income)`
        : null,
      "",
      `Open invoice: ${href}`,
    ]
      .filter(Boolean)
      .join("\n");

    const feeRowHtml =
      input.feeAmount > 0
        ? `<tr>
            <td style="padding:6px 0;color:#555;font-size:14px;">Card fee (paid to Stripe, not received)</td>
            <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600;">${formatCurrency(input.feeAmount)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#555;font-size:14px;">Customer card charged</td>
            <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600;">${formatCurrency(input.chargeAmount)}</td>
          </tr>`
        : "";

    const htmlBody = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f7f7f4;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
    <div style="background:#fff;border:1px solid #ecece8;border-radius:12px;padding:24px;">
      <p style="margin:0 0 8px;font-size:18px;font-weight:700;">Online payment received</p>
      <p style="margin:0 0 16px;font-size:13px;color:#666;">
        ${escapeHtml(invoiceNumber)} · ${escapeHtml(paidLabel)}
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">
        <strong>${escapeHtml(customerName)}</strong>${escapeHtml(customerCompany)}
        ${customer?.email ? `<br /><span style="color:#666;">${escapeHtml(customer.email)}</span>` : ""}
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;">
        <tr>
          <td style="padding:6px 0;color:#555;font-size:14px;">Amount received</td>
          <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600;">${formatCurrency(input.invoiceAmount)}</td>
        </tr>
        ${feeRowHtml}
        <tr>
          <td style="padding:10px 0 0;border-top:1px solid #ecece8;font-size:15px;font-weight:700;">Posted to books</td>
          <td style="padding:10px 0 0;border-top:1px solid #ecece8;text-align:right;font-size:16px;font-weight:700;">${formatCurrency(input.invoiceAmount)}</td>
        </tr>
      </table>
      <p style="margin:0;">
        <a href="${escapeHtml(href)}" style="display:inline-block;background:#f54e00;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:700;">
          Open invoice
        </a>
      </p>
    </div>
  </div>
</body>
</html>`;

    let sent = 0;
    for (const r of recipients) {
      const result = await sendBrevoEmail({
        toEmail: r.email!,
        toName: r.full_name || r.email,
        subject: `Payment received · ${invoiceNumber} · ${formatCurrency(input.invoiceAmount)}`,
        htmlContent: htmlBody,
        textContent: textBody,
      });
      if (result.ok) sent += 1;
      else console.error("staff payment notice", r.email, result.error);
    }

    return { ok: true, sent };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Staff notice failed",
    };
  }
}
