/**
 * Card processing fee lines for paid invoices (pass-through fee on Stripe).
 * When present, invoice PDF / paper preview must show fee + amount charged
 * so the document matches the customer's card charge to the penny.
 */

export type InvoiceCardFeeDisplay = {
  /** Invoice principal (usually invoice.total) */
  invoiceAmount: number;
  /** Pass-through card processing fee */
  feeAmount: number;
  /** Total charged to customer (invoice + fee) */
  chargeAmount: number;
  paidAt?: string | null;
};

export function money2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Resolve fee when Stripe stored 0/missing but charge > principal.
 * Keeps email totals and PDF fee lines consistent.
 */
export function resolveCardFeeAmounts(opts: {
  invoiceTotal: number;
  amount?: number | null;
  feeAmount?: number | null;
  chargeAmount?: number | null;
}): { invoiceAmount: number; feeAmount: number; chargeAmount: number } {
  const invoiceAmount = money2(
    opts.amount != null && Number.isFinite(Number(opts.amount))
      ? Number(opts.amount)
      : opts.invoiceTotal
  );

  let chargeAmount = money2(
    opts.chargeAmount != null && Number.isFinite(Number(opts.chargeAmount))
      ? Number(opts.chargeAmount)
      : 0
  );

  let feeAmount = money2(
    opts.feeAmount != null && Number.isFinite(Number(opts.feeAmount))
      ? Number(opts.feeAmount)
      : 0
  );

  // Derive fee from charge − principal when fee was lost/zeroed incorrectly
  if (!(feeAmount > 0) && chargeAmount > invoiceAmount + 0.001) {
    feeAmount = money2(chargeAmount - invoiceAmount);
  }

  // Derive charge when we only have fee
  if (!(chargeAmount > 0) && feeAmount > 0) {
    chargeAmount = money2(invoiceAmount + feeAmount);
  }

  // Offline / no fee: charge equals principal
  if (!(chargeAmount > 0)) {
    chargeAmount = invoiceAmount;
  }

  return { invoiceAmount, feeAmount, chargeAmount };
}

/**
 * Build fee display when a processing fee was charged.
 * Returns null when there is no fee (offline pay or fee = 0).
 */
export function cardFeeDisplayFromPayment(opts: {
  invoiceTotal: number;
  paidAt?: string | null;
  /** Principal applied from stripe_invoice_payments.amount */
  amount?: number | null;
  feeAmount?: number | null;
  chargeAmount?: number | null;
}): InvoiceCardFeeDisplay | null {
  const resolved = resolveCardFeeAmounts(opts);
  if (!(resolved.feeAmount > 0)) return null;

  return {
    invoiceAmount: resolved.invoiceAmount,
    feeAmount: resolved.feeAmount,
    chargeAmount: resolved.chargeAmount,
    paidAt: opts.paidAt ?? null,
  };
}

export type StripePaymentFeeRow = {
  amount?: number | null;
  fee_amount?: number | null;
  charge_amount?: number | null;
  status?: string | null;
};

export function cardFeeDisplayFromStripeRow(
  invoiceTotal: number,
  paidAt: string | null | undefined,
  row: StripePaymentFeeRow | null | undefined
): InvoiceCardFeeDisplay | null {
  if (!row) return null;
  if (row.status && row.status !== "succeeded") return null;
  return cardFeeDisplayFromPayment({
    invoiceTotal,
    paidAt,
    amount: row.amount,
    feeAmount: row.fee_amount,
    chargeAmount: row.charge_amount,
  });
}
