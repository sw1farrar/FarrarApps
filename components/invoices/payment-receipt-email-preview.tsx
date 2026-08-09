"use client";

import { FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InvoiceCardFeeDisplay } from "@/lib/invoices/card-fee-display";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";
import { InvoicePaperPreview } from "@/components/invoices/invoice-paper-preview";

/**
 * Light-mode email mock for paid receipts (mirrors InvoiceEmailPreview).
 * Hard-coded colors so dark app theme cannot wash out the preview type.
 */
export function PaymentReceiptEmailPreview({
  invoice,
  lines,
  customer,
  company,
  logoUrl,
  recipient,
  invoiceAmount,
  feeAmount,
  chargeAmount,
  paidAt,
  cardFee,
}: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoUrl?: string | null;
  recipient: string;
  invoiceAmount: number;
  feeAmount: number;
  chargeAmount: number;
  paidAt?: string | null;
  cardFee?: InvoiceCardFeeDisplay | null;
}) {
  const companyName = company?.name || "Farrar Apps";
  const customerName = customer?.name || "there";
  const paidLabel = paidAt
    ? formatDate(paidAt)
    : formatDate(new Date().toISOString());
  const resolvedFee =
    cardFee ??
    (feeAmount > 0
      ? {
          invoiceAmount,
          feeAmount,
          chargeAmount,
          paidAt: paidAt ?? null,
        }
      : null);

  return (
    <div
      className="mx-auto w-full max-w-[560px] space-y-4 text-[#1a1a1a]"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <div className="flex items-center justify-between gap-2 text-[11px] text-[#666]">
        <span className="truncate">
          To: {recipient || "recipient@example.com"}
        </span>
        <span className="shrink-0">Email preview</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e8e8e4] bg-white shadow-sm">
        <div className="border-b border-[#ecece8] px-5 py-4 text-center">
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
              Payment received
            </p>
            <p className="mt-1 text-xs text-[#666]">
              Invoice {invoice.invoice_number} · Paid {paidLabel}
            </p>
          </div>

          <p className="text-sm leading-6 text-[#333]">
            Hi {customerName},
            <br />
            <br />
            Thank you for your payment. Here is a summary of charges for invoice{" "}
            {invoice.invoice_number}. A PDF of the paid invoice
            {feeAmount > 0 ? " (including the card processing fee)" : ""} is
            attached.
          </p>

          <div className="rounded-xl border border-[#ecece8] bg-[#fafaf8] px-4 py-3 text-sm text-[#1a1a1a]">
            <div className="flex justify-between py-1">
              <span className="text-[#555]">Invoice amount</span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(invoiceAmount)}
              </span>
            </div>
            {feeAmount > 0 ? (
              <div className="flex justify-between py-1">
                <span className="text-[#555]">Card processing fee</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(feeAmount)}
                </span>
              </div>
            ) : null}
            <div className="mt-1 flex justify-between border-t border-[#ecece8] pt-2">
              <span className="font-bold text-[#1a1a1a]">Total paid</span>
              <span className="text-lg font-bold tabular-nums text-[#1a1a1a]">
                {formatCurrency(chargeAmount)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-[#ecece8] bg-[#fafaf8] px-3 py-2.5">
            <div className="flex size-9 items-center justify-center rounded-md bg-white ring-1 ring-[#ecece8]">
              <FileText className="size-4 text-[#d44a00]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#1a1a1a]">
                {invoice.invoice_number}.pdf
              </p>
              <p className="text-xs text-[#777]">
                Paid invoice PDF
                {feeAmount > 0 ? " · includes processing fee" : ""}
              </p>
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
            cardFee={resolvedFee}
          />
        </div>
      </div>
    </div>
  );
}
