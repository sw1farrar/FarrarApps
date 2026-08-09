import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";

/**
 * Expire open Checkout sessions for an invoice so only one charge can complete.
 * Best-effort: failures are logged, not thrown.
 */
export async function expireOpenCheckoutSessionsForInvoice(
  invoiceId: string,
  exceptSessionId?: string | null
) {
  try {
    const stripe = getStripe();
    // Stripe list doesn't filter by metadata; scan recent open sessions
    const open = await stripe.checkout.sessions.list({
      status: "open",
      limit: 40,
    });
    const targets = open.data.filter(
      (s) =>
        s.metadata?.invoice_id === invoiceId &&
        s.id !== exceptSessionId &&
        s.status === "open"
    );
    await Promise.all(
      targets.map((s) =>
        stripe.checkout.sessions.expire(s.id).catch((err: unknown) => {
          console.warn(
            "expire session",
            s.id,
            err instanceof Error ? err.message : err
          );
        })
      )
    );
  } catch (e) {
    console.warn(
      "expireOpenCheckoutSessionsForInvoice",
      e instanceof Error ? e.message : e
    );
  }
}

export async function expireOpenCheckoutSessionsAfterPaid(
  invoiceId: string
) {
  return expireOpenCheckoutSessionsForInvoice(invoiceId);
}

/** Type re-export helper for callers that list sessions */
export type { Stripe };
