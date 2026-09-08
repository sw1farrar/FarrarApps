import Image from "next/image";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InvoiceCardFeeDisplay } from "@/lib/invoices/card-fee-display";
import {
  remittanceCompanyName,
  remittanceCopy,
  shouldShowCardRemittance,
} from "@/lib/invoices/card-fee-remittance";
import {
  buildInvoicePreviewPages,
  invoiceBillToName,
  invoiceCustomerAddress,
  invoiceLinesHaveDates,
} from "@/lib/invoices/invoice-document";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

function LineTable({
  lines,
  showDate,
}: {
  lines: InvoiceLineItem[];
  showDate: boolean;
}) {
  return (
    <table className="w-full border-collapse text-[9px] leading-tight">
      <thead>
        <tr className="border-b border-[#111] text-left text-[8px] font-semibold uppercase tracking-wide text-[#444]">
          {showDate ? <th className="w-[22%] pb-1 pr-2 font-semibold">Date</th> : null}
          <th className="pb-1 pr-2 font-semibold">Description</th>
          <th className="w-[12%] pb-1 text-right font-semibold">Qty</th>
          <th className="w-[16%] pb-1 text-right font-semibold">Rate</th>
          <th className="w-[16%] pb-1 text-right font-semibold">Amount</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id} className="border-b border-[#ececec] align-top">
            {showDate ? (
              <td className="py-[3px] pr-2 text-[8px] tabular-nums text-[#555]">
                {line.service_date ? formatDate(line.service_date) : ""}
              </td>
            ) : null}
            <td className="py-[3px] pr-2">{line.description}</td>
            <td className="py-[3px] text-right tabular-nums">
              {Number(line.quantity)}
            </td>
            <td className="py-[3px] text-right tabular-nums">
              {formatCurrency(line.rate)}
            </td>
            <td className="py-[3px] text-right tabular-nums">
              {formatCurrency(line.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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
  const billTo = invoiceBillToName(customer);
  const customerAddress = invoiceCustomerAddress(customer);
  const showDate = invoiceLinesHaveDates(lines);
  const pages = buildInvoicePreviewPages({
    lines,
    hasCompanyAddress: Boolean(company?.address),
    hasCustomerAddress: Boolean(customerAddress),
    hasCustomerEmail: Boolean(customer?.email),
    isPaid,
    showRemittance,
    showTax: Number(invoice.tax) !== 0,
    terms,
    hasDateColumn: showDate,
  });
  const pageCount = pages.length;

  const header = (
    <div className="mb-2 shrink-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Image
            src={logoUrl || "/farrar_apps_logo.png"}
            alt={`${companyName} logo`}
            width={120}
            height={32}
            className="mb-1 h-7 w-auto max-w-[140px] object-contain object-left"
            unoptimized
          />
          <p className="text-[10px] font-semibold leading-tight">{companyName}</p>
          {company?.address ? (
            <p className="text-[8px] leading-tight text-[#555]">{company.address}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[8px] font-semibold tracking-[0.12em] text-[#666]">
            INVOICE
          </p>
          <p className="text-[13px] font-semibold leading-tight">
            {invoice.invoice_number}
          </p>
          <div className="mt-1 space-y-px text-[8px] leading-tight">
            <p>
              <span className="text-[#666]">Issued </span>
              {formatDate(invoice.issue_date)}
            </p>
            <p>
              <span className="text-[#666]">Due </span>
              {formatDate(invoice.due_date)}
            </p>
            {isPaid ? (
              <p className="font-semibold text-emerald-700">
                PAID
                {paidDate ? ` · ${formatDate(paidDate)}` : ""}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-2 border-t border-[#ddd] pt-1.5 text-[9px] leading-tight">
        <p className="text-[7px] font-semibold tracking-wide text-[#666]">
          BILL TO
        </p>
        <p>{billTo}</p>
        {customerAddress ? (
          <p className="text-[8px] text-[#555]">{customerAddress}</p>
        ) : null}
        {customer?.email ? (
          <p className="text-[8px] text-[#555]">{customer.email}</p>
        ) : null}
      </div>
    </div>
  );

  const footer = (
    <div className="mt-2 shrink-0">
      <div className="space-y-px text-right text-[9px] leading-tight text-[#1a1a1a]">
        <div className="flex justify-end gap-4">
          <span className="text-[#666]">Subtotal</span>
          <span className="w-16 tabular-nums">
            {formatCurrency(invoice.subtotal)}
          </span>
        </div>
        {Number(invoice.tax) !== 0 ? (
          <div className="flex justify-end gap-4">
            <span className="text-[#666]">Tax</span>
            <span className="w-16 tabular-nums">
              {formatCurrency(invoice.tax)}
            </span>
          </div>
        ) : null}
        <div className="mt-0.5 flex justify-end gap-4 border-t border-[#111] pt-0.5 text-[10px] font-semibold">
          <span>{isPaid ? "Amount paid" : "Total"}</span>
          <span className="w-16 tabular-nums">
            {formatCurrency(invoice.total)}
          </span>
        </div>
      </div>

      {showRemittance && cardFee ? (
        <div className="mt-2 border border-[#ecece8] bg-[#fafaf8] px-2 py-1.5 text-left text-[8px] leading-tight text-[#444]">
          <p className="mb-1 text-[7px] font-semibold uppercase tracking-wide text-[#666]">
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
          <div className="mt-0.5 flex justify-between gap-3 border-t border-[#ddd] pt-0.5 font-semibold text-[#1a1a1a]">
            <span>{copy.cardTotalLabel}</span>
            <span className="tabular-nums">
              {formatCurrency(cardFee.chargeAmount)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-2 border-t border-[#e5e5e5] pt-1.5 text-[8px] leading-tight text-[#666]">
        <p className="mb-px font-medium text-[#444]">Terms</p>
        <p>{terms}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 bg-[#f3f3f1] p-3 text-[#1a1a1a]">
      {pages.map((pageLines, pageIndex) => {
        const isFirst = pageIndex === 0;
        const isLast = pageIndex === pageCount - 1;
        return (
          <div
            key={pageIndex}
            className="mx-auto flex aspect-[8.5/11] w-full max-w-[520px] flex-col overflow-hidden bg-white shadow-sm ring-1 ring-black/5"
          >
            <div className="flex min-h-0 flex-1 flex-col px-3.5 pt-3.5">
              {isFirst ? (
                header
              ) : (
                <p className="mb-1.5 shrink-0 text-[8px] leading-tight text-[#666]">
                  {invoice.invoice_number} · continued
                </p>
              )}
              {pageLines.length > 0 ? (
                <LineTable lines={pageLines} showDate={showDate} />
              ) : null}
              {isLast ? footer : null}
              <div className="min-h-0 flex-1" />
            </div>
            <div className="px-3.5 pb-2 pt-1 text-center text-[8px] leading-none text-[#999]">
              {pageCount > 1
                ? `${invoice.invoice_number}  ·  ${pageIndex + 1} / ${pageCount}`
                : "\u00a0"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
