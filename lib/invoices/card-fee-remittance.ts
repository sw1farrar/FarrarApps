import type { InvoiceCardFeeDisplay } from "@/lib/invoices/card-fee-display";

/**
 * Display-only remittance for a customer receipt.
 * Invoice totals stay at the booked amount (what Farrar Apps received).
 * The fee is paid to the card processor and is never company income.
 */
export type InvoiceCardRemittance = InvoiceCardFeeDisplay;

export function remittanceCompanyName(companyName?: string | null) {
  const name = companyName?.trim();
  return name || "Farrar Apps";
}

export function shouldShowCardRemittance(
  includeCardRemittance: boolean | undefined,
  cardFee: InvoiceCardFeeDisplay | null | undefined
): cardFee is InvoiceCardFeeDisplay {
  return Boolean(includeCardRemittance && cardFee && cardFee.feeAmount > 0);
}

export function remittanceCopy(companyName?: string | null) {
  const name = remittanceCompanyName(companyName);
  return {
    heading: "How this was paid",
    paidToLabel: `Paid to ${name}`,
    feeLabel: `Card processing fee (paid to the card processor, not ${name})`,
    cardTotalLabel: "Total charged to card",
  };
}
