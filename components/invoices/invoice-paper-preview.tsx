import Image from "next/image";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InvoiceCardFeeDisplay } from "@/lib/invoices/card-fee-display";
import {
  remittanceCompanyName,
  remittanceCopy,
  shouldShowCardRemittance,
} from "@/lib/invoices/card-fee-remittance";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

export function InvoicePaperPreview({
  invoice,
  lines,
  customer,
  company,
  logoUrl,
  cardFee,
  includeCardRemittance = false,
}: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoUrl?: string | null;
  cardFee?: InvoiceCardFeeDisplay | null;
  /** Customer receipt only — remittance sits below booked invoice totals. */
  includeCardRemittance?: boolean;
}) {
  const companyName = remittanceCompanyName(company?.name);
  const terms =
    invoice.notes ||
    company?.invoice_terms ||
    "Payment is due within 30 days of invoice date.";
  const showRemittance = shouldShowCardRemittance(
    includeCardRemittance,
    cardFee
  );
  const copy = remittanceCopy(companyName);
  const isPaid = invoice.status === "paid";
  const paidDate = invoice.paid_at;

  return (
    <div className="bg-[#f3f3f1] p-4 text-[#1a1a1a]">
      <div className="mx-auto aspect-[8.5/11] w-full max-w-[520px] bg-white shadow-sm ring-1 ring-black/5">
        <div className="flex h-full flex-col p-6 sm:p-8">
          <div className="mb-5 flex shrink-0 justify-center">
            <Image
              src={logoUrl || "/farrar_apps_logo.png"}
              alt={`${companyName} logo`}
              width={160}
              height={48}
              className="h-10 w-auto object-contain"
              unoptimized
            />
          </div>

          <div className="mb-4 shrink-0 space-y-1 text-[11px] leading-5">
            <h3 className="text-sm font-semibold">
              Invoice {invoice.invoice_number}
            </h3>
            <p>{companyName}</p>
            {company?.address ? <p>{company.address}</p> : null}
            <p>
              Bill to: {customer?.name || "Customer"}
              {customer?.company ? ` (${customer.company})` : ""}
            </p>
            {customer?.email ? <p>{customer.email}</p> : null}
            <p>
              Issued {formatDate(invoice.issue_date)} · Due{" "}
              {formatDate(invoice.due_date)}
            </p>
            {isPaid ? (
              <p className="font-semibold text-emerald-700">
                PAID
                {paidDate ? ` · ${formatDate(paidDate)}` : ""}
              </p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-b border-[#111] text-left">
                  <th className="pb-1.5 font-semibold">Description</th>
                  <th className="pb-1.5 text-right font-semibold">Qty</th>
                  <th className="pb-1.5 text-right font-semibold">Rate</th>
                  <th className="pb-1.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-[#e5e5e5]">
                    <td className="py-1.5 pr-2">
                      {line.service_date ? (
                        <div>
                          <div className="text-[9px] text-[#666]">
                            {formatDate(line.service_date)}
                          </div>
                          <div>{line.description}</div>
                        </div>
                      ) : (
                        line.description
                      )}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {Number(line.quantity)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatCurrency(line.rate)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatCurrency(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 shrink-0 space-y-0.5 text-right text-[10px] text-[#1a1a1a]">
            <div className="flex justify-end gap-6">
              <span className="text-[#666]">Subtotal</span>
              <span className="w-20 tabular-nums">
                {formatCurrency(invoice.subtotal)}
              </span>
            </div>
            {Number(invoice.tax) !== 0 ? (
              <div className="flex justify-end gap-6">
                <span className="text-[#666]">Tax</span>
                <span className="w-20 tabular-nums">
                  {formatCurrency(invoice.tax)}
                </span>
              </div>
            ) : null}
            <div className="mt-1 flex justify-end gap-6 border-t border-[#111] pt-1 text-xs font-semibold text-[#1a1a1a]">
              <span>{isPaid ? "Amount paid" : "Total"}</span>
              <span className="w-20 tabular-nums">
                {formatCurrency(invoice.total)}
              </span>
            </div>
          </div>

          {showRemittance && cardFee ? (
            <div className="mt-3 shrink-0 rounded-md border border-[#ecece8] bg-[#fafaf8] px-2.5 py-2 text-left text-[9px] leading-4 text-[#444]">
              <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-wide text-[#666]">
                {copy.heading}
              </p>
              <div className="flex justify-between gap-3">
                <span>{copy.paidToLabel}</span>
                <span className="tabular-nums">
                  {formatCurrency(cardFee.invoiceAmount)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>{copy.feeLabel}</span>
                <span className="tabular-nums">
                  {formatCurrency(cardFee.feeAmount)}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3 border-t border-[#ddd] pt-1 font-semibold text-[#1a1a1a]">
                <span>{copy.cardTotalLabel}</span>
                <span className="tabular-nums">
                  {formatCurrency(cardFee.chargeAmount)}
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-4 shrink-0 border-t border-[#e5e5e5] pt-3 text-[9px] leading-4 text-[#666]">
            <p className="mb-0.5 font-medium text-[#444]">Terms</p>
            <p>{terms}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
