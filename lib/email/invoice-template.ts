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

function messageToHtml(message: string) {
  return escapeHtml(message).replaceAll("\n", "<br />");
}

/**
 * Transactional invoice email (HTML).
 * Line items live in the attached PDF only — keep the body minimal.
 */
export function buildInvoiceEmailHtml(input: {
  invoice: Invoice;
  /** Unused in body; PDF carries line detail. Kept for call-site compatibility. */
  lines?: InvoiceLineItem[];
  customer: Customer;
  company: CompanySettings | null;
  payUrl?: string | null;
  pdfUrl?: string | null;
  message?: string;
  logoUrl?: string | null;
}) {
  const { invoice, customer, company, payUrl, pdfUrl, message, logoUrl } = input;
  const companyName = company?.name || "Farrar Apps";
  const terms =
    invoice.notes ||
    company?.invoice_terms ||
    "Payment is due within 30 days of invoice date.";
  const body =
    message?.trim() ||
    `Hi ${customer.name},\n\nPlease find invoice ${invoice.invoice_number} attached.`;
  const showPay =
    Boolean(payUrl) &&
    invoice.status !== "paid" &&
    Number(invoice.total) > 0;
  const ctaUrl = showPay ? payUrl! : payUrl || pdfUrl || "#";
  const ctaLabel = showPay ? "Pay online" : "View invoice";

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}" width="240" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:auto;max-width:240px;max-height:72px;" />`
    : `<div style="font-size:20px;font-weight:700;letter-spacing:0.04em;color:#1a1a1a;">${escapeHtml(companyName)}</div>`;

  const payCtaBlock = showPay
    ? `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 8px;">
            <tr>
              <td align="center" style="padding:4px 0 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="#f54e00" style="border-radius:8px;background-color:#f54e00;">
                      <a href="${escapeHtml(ctaUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                        ${escapeHtml(ctaLabel)} · ${formatCurrency(invoice.total)}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Invoice ${escapeHtml(invoice.invoice_number)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:#f7f7f4;color:#1a1a1a;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f7f7f4;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid #ecece8;border-radius:16px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 24px 20px;border-bottom:1px solid #ecece8;background:#ffffff;">
              ${logoBlock}
            </td>
          </tr>

          <tr>
            <td style="padding:28px 24px 24px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#1a1a1a;line-height:1.3;">
                Invoice ${escapeHtml(invoice.invoice_number)}
              </p>
              <p style="margin:0 0 18px;color:#666;font-size:13px;line-height:1.5;">
                From ${escapeHtml(companyName)} · Issued ${escapeHtml(formatDate(invoice.issue_date))} · Due ${escapeHtml(formatDate(invoice.due_date))}
              </p>

              <div style="margin:0 0 22px;color:#333;font-size:14px;line-height:1.7;">
                ${messageToHtml(body)}
              </div>

              ${payCtaBlock}

              ${
                terms
                  ? `<p style="margin:20px 0 0;color:#888;font-size:12px;line-height:1.55;">${escapeHtml(terms)}</p>`
                  : ""
              }
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:16px 24px;border-top:1px solid #ecece8;background:#fcfcfb;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999;">
              ${escapeHtml(companyName)}${company?.email ? ` · <a href="mailto:${escapeHtml(company.email)}" style="color:#999;text-decoration:none;">${escapeHtml(company.email)}</a>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildInvoiceEmailText(input: {
  invoice: Invoice;
  customer: Customer;
  company: CompanySettings | null;
  payUrl?: string | null;
  pdfUrl?: string | null;
  message?: string;
}) {
  const companyName = input.company?.name || "Farrar Apps";
  const body =
    input.message?.trim() ||
    `Hi ${input.customer.name},\n\nPlease find invoice ${input.invoice.invoice_number} attached.`;
  const lines = [
    body,
    "",
    `Invoice ${input.invoice.invoice_number} from ${companyName}`,
    `Issued ${formatDate(input.invoice.issue_date)} · Due ${formatDate(input.invoice.due_date)}`,
    `Amount due: ${formatCurrency(input.invoice.total)}`,
    "",
    `PDF attached: ${input.invoice.invoice_number}.pdf`,
  ];
  if (input.payUrl) {
    lines.push("", "Pay online:", input.payUrl);
  } else if (input.pdfUrl) {
    lines.push("", input.pdfUrl);
  }
  return lines.join("\n");
}
