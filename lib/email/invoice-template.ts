import { formatCurrency, formatDate } from "@/lib/format";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildInvoiceEmailHtml(input: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer;
  company: CompanySettings | null;
  pdfUrl: string;
}) {
  const { invoice, lines, customer, company, pdfUrl } = input;
  const companyName = company?.name || "Farrar Apps";
  const terms =
    invoice.notes ||
    company?.invoice_terms ||
    "Payment is due within 30 days of invoice date.";

  const rows = lines
    .map(
      (line) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;">${escapeHtml(line.description)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;text-align:right;">${Number(line.quantity)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;text-align:right;">${formatCurrency(line.rate)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e5e5;text-align:right;">${formatCurrency(line.amount)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#0b0b0b;color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;">
        <div>
          <div style="font-size:22px;font-weight:700;letter-spacing:0.04em;">${escapeHtml(companyName)}</div>
          <div style="color:#a3a3a3;font-size:13px;margin-top:4px;">Invoice ready</div>
        </div>
        <div style="font-size:18px;font-weight:700;letter-spacing:0.18em;color:#d4d4d4;">APPS</div>
      </div>

      <div style="background:#141414;border:1px solid #262626;border-radius:12px;padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;">Hi ${escapeHtml(customer.name)},</p>
        <p style="margin:0 0 20px;color:#d4d4d4;line-height:1.5;font-size:14px;">
          Please find invoice <strong>${escapeHtml(invoice.invoice_number)}</strong> below.
          Issued ${escapeHtml(formatDate(invoice.issue_date))} · Due ${escapeHtml(formatDate(invoice.due_date))}.
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #404040;color:#a3a3a3;font-weight:600;">Description</th>
              <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #404040;color:#a3a3a3;font-weight:600;">Qty</th>
              <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #404040;color:#a3a3a3;font-weight:600;">Rate</th>
              <th style="text-align:right;padding:10px 12px;border-bottom:1px solid #404040;color:#a3a3a3;font-weight:600;">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div style="text-align:right;font-size:14px;line-height:1.7;">
          <div>Subtotal: ${formatCurrency(invoice.subtotal)}</div>
          <div>Tax: ${formatCurrency(invoice.tax)}</div>
          <div style="font-size:18px;font-weight:700;margin-top:4px;">Total: ${formatCurrency(invoice.total)}</div>
        </div>

        <div style="margin-top:24px;text-align:center;">
          <a href="${escapeHtml(pdfUrl)}" style="display:inline-block;background:#f5f5f5;color:#0b0b0b;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;font-size:13px;">
            View / download PDF
          </a>
        </div>

        <p style="margin:24px 0 0;color:#a3a3a3;font-size:12px;line-height:1.5;">
          ${escapeHtml(terms)}
        </p>
      </div>

      <p style="margin:20px 0 0;color:#737373;font-size:12px;text-align:center;">
        ${escapeHtml(companyName)}${company?.email ? ` · ${escapeHtml(company.email)}` : ""}
      </p>
    </div>
  </body>
</html>`;
}

export function buildInvoiceEmailText(input: {
  invoice: Invoice;
  customer: Customer;
  company: CompanySettings | null;
  pdfUrl: string;
}) {
  const companyName = input.company?.name || "Farrar Apps";
  return [
    `Hi ${input.customer.name},`,
    "",
    `Invoice ${input.invoice.invoice_number} from ${companyName}.`,
    `Issued ${formatDate(input.invoice.issue_date)} · Due ${formatDate(input.invoice.due_date)}.`,
    `Total: ${formatCurrency(input.invoice.total)}`,
    "",
    `View PDF: ${input.pdfUrl}`,
  ].join("\n");
}
