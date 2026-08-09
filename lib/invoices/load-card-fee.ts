import "server-only";

import {
  cardFeeDisplayFromStripeRow,
  type InvoiceCardFeeDisplay,
} from "@/lib/invoices/card-fee-display";

/** Load card fee display for a paid invoice (if Stripe fee was passed through). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadInvoiceCardFee(
  // Accept any Supabase client shape without deep instantiation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  invoiceId: string,
  invoiceTotal: number,
  paidAt?: string | null
): Promise<InvoiceCardFeeDisplay | null> {
  const { data: stripePay } = await supabase
    .from("stripe_invoice_payments")
    .select("amount, charge_amount, fee_amount, status")
    .eq("invoice_id", invoiceId)
    .eq("status", "succeeded")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return cardFeeDisplayFromStripeRow(invoiceTotal, paidAt, stripePay);
}
