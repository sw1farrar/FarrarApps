import { FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { InvoicePaperPreview } from "@/components/invoices/invoice-paper-preview";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

export function InvoiceEmailPreview({
  invoice,
  lines,
  customer,
  company,
  logoUrl,
  message,
  recipient,
}: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoUrl?: string | null;
  message: string;
  recipient: string;
}) {
  const companyName = company?.name || "Farrar Apps";
  const customerName = customer?.name || "Customer";
  const showPay =
    invoice.status !== "paid" && Number(invoice.total) > 0;

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-4 text-[#1a1a1a]">
      <div className="flex items-center justify-between gap-2 text-[11px] text-[#666]">
        <span className="truncate">
          To: {recipient || "recipient@example.com"}
        </span>
        <span className="shrink-0">Email preview</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e8e8e4] bg-white shadow-sm">
        <div className="border-b border-[#ecece8] px-5 py-4 text-center">
          {/* Native img: Next/Image can fail on signed storage URLs in this panel */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl || "/farrar_apps_logo.png"}
            alt={`${companyName} logo`}
            width={280}
            height={80}
            className="mx-auto h-20 w-auto max-w-[320px] object-contain"
          />
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <p className="text-base font-semibold text-[#1a1a1a]">
              Invoice {invoice.invoice_number}
            </p>
            <p className="mt-1 text-xs text-[#666]">
              From {companyName} · Issued {formatDate(invoice.issue_date)} · Due{" "}
              {formatDate(invoice.due_date)}
            </p>
          </div>

          <div className="whitespace-pre-wrap text-sm leading-6 text-[#333]">
            {message ||
              `Hi ${customerName},\n\nPlease find invoice ${invoice.invoice_number} attached.\n\nThank you,\n${companyName}`}
          </div>

          {showPay ? (
            <div className="text-center">
              <div
                className="inline-flex cursor-default select-none items-center justify-center rounded-lg bg-[#f54e00] px-6 py-3 text-[15px] font-bold text-white shadow-sm"
                aria-hidden
              >
                Pay online · {formatCurrency(invoice.total)}
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3 rounded-lg border border-[#ecece8] bg-[#fafaf8] px-3 py-2.5">
            <div className="flex size-9 items-center justify-center rounded-md bg-white ring-1 ring-[#ecece8]">
              <FileText className="size-4 text-[#d44a00]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {invoice.invoice_number}.pdf
              </p>
              <p className="text-xs text-[#777]">PDF attachment</p>
            </div>
          </div>
        </div>

        <div className="border-t border-[#ecece8] px-5 py-3 text-center text-[11px] text-[#999]">
          {companyName}
          {company?.email ? ` · ${company.email}` : ""}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#888]">
          Attached PDF preview
        </p>
        <div className="overflow-hidden rounded-xl border border-[#e8e8e4] bg-[#f3f3f1]">
          <InvoicePaperPreview
            invoice={invoice}
            lines={lines}
            customer={customer}
            company={company}
            logoUrl={logoUrl}
          />
        </div>
      </div>
    </div>
  );
}
