/**
 * Stripe card fee pass-through (gross-up) so net ≈ invoice total.
 *
 * charge = (invoice + fixed) / (1 - percent)
 * fee = charge - invoice
 */

export type StripeFeeSettings = {
  percent: number; // e.g. 2.9 meaning 2.9%
  fixed: number; // e.g. 0.30 USD
};

export const DEFAULT_STRIPE_FEE_SETTINGS: StripeFeeSettings = {
  percent: 2.9,
  fixed: 0.3,
};

export type CardPassThrough = {
  invoiceAmount: number;
  feeAmount: number;
  chargeTotal: number;
  invoiceCents: number;
  feeCents: number;
  chargeCents: number;
};

function toCents(dollars: number) {
  return Math.round(Number(dollars) * 100);
}

function fromCents(cents: number) {
  return Math.round(cents) / 100;
}

export function normalizeFeeSettings(input?: {
  percent?: number | null;
  fixed?: number | null;
  stripe_fee_percent?: number | null;
  stripe_fee_fixed?: number | null;
} | null): StripeFeeSettings {
  const percentRaw =
    input?.percent ?? input?.stripe_fee_percent ?? DEFAULT_STRIPE_FEE_SETTINGS.percent;
  const fixedRaw =
    input?.fixed ?? input?.stripe_fee_fixed ?? DEFAULT_STRIPE_FEE_SETTINGS.fixed;
  let percent = Number(percentRaw);
  let fixed = Number(fixedRaw);
  if (!Number.isFinite(percent) || percent < 0) percent = 0;
  if (percent >= 100) percent = 99.99;
  if (!Number.isFinite(fixed) || fixed < 0) fixed = 0;
  return { percent, fixed };
}

/**
 * Compute pass-through amounts in dollars and cents.
 * Pure function — safe for client preview and server checkout.
 */
export function computeCardPassThrough(
  invoiceTotal: number,
  settings?: StripeFeeSettings | null
): CardPassThrough {
  const invoiceAmount = Math.max(0, Number(invoiceTotal) || 0);
  const invoiceCents = toCents(invoiceAmount);
  const { percent, fixed } = normalizeFeeSettings(settings);
  const p = percent / 100;

  if (invoiceCents <= 0 || (percent <= 0 && fixed <= 0)) {
    return {
      invoiceAmount: fromCents(invoiceCents),
      feeAmount: 0,
      chargeTotal: fromCents(invoiceCents),
      invoiceCents,
      feeCents: 0,
      chargeCents: invoiceCents,
    };
  }

  // Gross-up so after (percent * charge + fixed) the net ≈ invoice
  const chargeRaw = (invoiceAmount + fixed) / (1 - p);
  let chargeCents = toCents(chargeRaw);
  // Never charge less than invoice
  if (chargeCents < invoiceCents) chargeCents = invoiceCents;
  let feeCents = chargeCents - invoiceCents;
  if (feeCents < 0) feeCents = 0;

  return {
    invoiceAmount: fromCents(invoiceCents),
    feeAmount: fromCents(feeCents),
    chargeTotal: fromCents(chargeCents),
    invoiceCents,
    feeCents,
    chargeCents,
  };
}
