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

export function buildPaymentReceiptEmailHtml(input: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer;
  company: CompanySettings | null;
  invoiceAmount: number;
  feeAmount: number;
  chargeAmount: number;
  logoUrl?: string | null;
  paidAt?: string | null;
}) {
  const {
    invoice,
    lines,
    customer,
    company,
    invoiceAmount,
    feeAmount,
    chargeAmount,
    logoUrl,
    paidAt,
  } = input;
  const companyName = company?.name || "Farrar Apps";
  const paidLabel = paidAt
    ? formatDate(paidAt)
    : formatDate(new Date().toISOString());

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}" width="240" style="display:block;margin:0 auto;border:0;height:auto;max-width:240px;max-height:72px;" />`
    : `<div style="font-size:20px;font-weight:700;color:#1a1a1a;">${escapeHtml(companyName)}</div>`;

  const lineRows = lines
    .map(
      (line) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #ecece8;font-size:13px;color:#333;">${escapeHtml(line.description)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #ecece8;font-size:13px;color:#333;text-align:right;white-space:nowrap;">${formatCurrency(line.amount)}</td>
      </tr>`
    )
    .join("");

  const feeRow =
    feeAmount > 0
      ? `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#555;">Card processing fee</td>
        <td style="padding:8px 0;font-size:14px;color:#1a1a1a;text-align:right;font-weight:600;">${formatCurrency(feeAmount)}</td>
      </tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment receipt ${escapeHtml(invoice.invoice_number)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f4;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f7f7f4;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid #ecece8;border-radius:16px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 24px 20px;border-bottom:1px solid #ecece8;">
              ${logoBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#1a1a1a;">
                Payment received
              </p>
              <p style="margin:0 0 18px;font-size:13px;color:#666;line-height:1.5;">
                Invoice ${escapeHtml(invoice.invoice_number)} · Paid ${escapeHtml(paidLabel)}
              </p>
              <p style="margin:0 0 20px;font-size:14px;color:#333;line-height:1.6;">
                Hi ${escapeHtml(customer.name)},<br /><br />
                Thank you for your payment. Here is a summary of charges for invoice ${escapeHtml(invoice.invoice_number)}.
                A PDF of the paid invoice${feeAmount > 0 ? " (including the card processing fee)" : ""} is attached so totals match what was charged.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;background:#fafaf8;border:1px solid #ecece8;border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#555;">Invoice amount</td>
                        <td style="padding:6px 0;font-size:14px;color:#1a1a1a;text-align:right;font-weight:600;">${formatCurrency(invoiceAmount)}</td>
                      </tr>
                      ${feeRow}
                      <tr>
                        <td style="padding:10px 0 0;font-size:15px;color:#1a1a1a;font-weight:700;border-top:1px solid #ecece8;">Total paid</td>
                        <td style="padding:10px 0 0;font-size:18px;color:#1a1a1a;text-align:right;font-weight:700;border-top:1px solid #ecece8;">${formatCurrency(chargeAmount)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${
                lines.length
                  ? `
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#888;">
                Invoice line items
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;border-collapse:collapse;">
                <thead>
                  <tr>
                    <th align="left" style="padding:8px 12px;border-bottom:1px solid #d9d9d4;font-size:11px;color:#666;font-weight:600;">Description</th>
                    <th align="right" style="padding:8px 12px;border-bottom:1px solid #d9d9d4;font-size:11px;color:#666;font-weight:600;">Amount</th>
                  </tr>
                </thead>
                <tbody>${lineRows}</tbody>
              </table>`
                  : ""
              }

              <p style="margin:0;font-size:12px;color:#888;line-height:1.5;">
                Bill to ${escapeHtml(customer.name)}${customer.company ? ` · ${escapeHtml(customer.company)}` : ""}.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 24px;border-top:1px solid #ecece8;background:#fcfcfb;font-size:12px;color:#999;">
              ${escapeHtml(companyName)}${company?.email ? ` · ${escapeHtml(company.email)}` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPaymentReceiptEmailText(input: {
  invoice: Invoice;
  customer: Customer;
  company: CompanySettings | null;
  invoiceAmount: number;
  feeAmount: number;
  chargeAmount: number;
}) {
  const companyName = input.company?.name || "Farrar Apps";
  const lines = [
    `Hi ${input.customer.name},`,
    "",
    `Payment received for invoice ${input.invoice.invoice_number}.`,
    "",
    `Invoice amount: ${formatCurrency(input.invoiceAmount)}`,
  ];
  if (input.feeAmount > 0) {
    lines.push(
      `Card processing fee: ${formatCurrency(input.feeAmount)}`
    );
  }
  lines.push(
    `Total paid: ${formatCurrency(input.chargeAmount)}`,
    "",
    input.feeAmount > 0
      ? `A PDF of the paid invoice (including the card processing fee) is attached.`
      : `A PDF of the paid invoice is attached.`,
    "",
    companyName
  );
  return lines.join("\n");
}
