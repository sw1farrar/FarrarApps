import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { applyStripeInvoicePayment } from "@/lib/stripe/apply-payment";

export const runtime = "nodejs";
/** Allow payment apply + receipt/staff emails to finish on Vercel */
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;

      if (
        event.type === "checkout.session.completed" &&
        session.payment_status &&
        session.payment_status !== "paid" &&
        session.payment_status !== "no_payment_required"
      ) {
        // Wait for async_payment_succeeded for delayed methods
        return NextResponse.json({
          received: true,
          pending: true,
          payment_status: session.payment_status,
        });
      }

      const invoiceId = session.metadata?.invoice_id;
      const customerId = session.metadata?.customer_id;
      if (!invoiceId || !customerId) {
        console.error(
          "stripe webhook missing metadata",
          event.id,
          session.id,
          session.metadata
        );
        // Do not ACK-skip money events — Stripe will retry
        return NextResponse.json(
          { error: "Missing invoice_id or customer_id in session metadata" },
          { status: 500 }
        );
      }

      const chargeAmount =
        (session.amount_total ?? 0) / 100 ||
        Number(session.amount_subtotal ?? 0) / 100;

      const metaInvoice = Number(session.metadata?.invoice_amount);
      const metaFee = Number(session.metadata?.fee_amount);
      // Prefer metadata fee; otherwise derive from charge − principal
      let feeAmount = Number.isFinite(metaFee) ? metaFee : NaN;
      if (!Number.isFinite(feeAmount) || feeAmount <= 0) {
        if (Number.isFinite(metaInvoice) && chargeAmount > metaInvoice) {
          feeAmount = Math.max(0, chargeAmount - metaInvoice);
        } else {
          feeAmount = Number.isFinite(metaFee) ? metaFee : 0;
        }
      }
      const principal = Number.isFinite(metaInvoice)
        ? metaInvoice
        : chargeAmount - (Number.isFinite(feeAmount) ? feeAmount : 0);

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;

      const result = await applyStripeInvoicePayment({
        invoiceId,
        customerId,
        chargeAmount,
        feeAmount: Number.isFinite(feeAmount) ? feeAmount : 0,
        amount: principal > 0 ? principal : chargeAmount,
        currency: session.currency || "usd",
        checkoutSessionId: session.id,
        paymentIntentId,
        raw: session,
      });

      if (!result.ok) {
        console.error("applyStripeInvoicePayment", result.error);
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("stripe webhook", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
