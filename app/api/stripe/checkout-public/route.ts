import { NextResponse } from "next/server";
import { createClient as createAnon } from "@supabase/supabase-js";
import {
  hashPaymentToken,
  resolvePaymentLink,
} from "@/lib/invoices/payment-link";
import { computeCardPassThrough, normalizeFeeSettings } from "@/lib/stripe/fee";
import { expireOpenCheckoutSessionsForInvoice } from "@/lib/stripe/expire-open-sessions";
import { getCheckoutOrigin } from "@/lib/stripe/site-url";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

export async function POST(request: Request) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 }
      );
    }

    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const resolved = await resolvePaymentLink(token);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const { invoice, customer, payable, reason, company, tokenHash } =
      resolved.data;
    if (!payable) {
      return NextResponse.json(
        { error: reason || "Invoice is not payable" },
        { status: 400 }
      );
    }

    const invoiceTotal = Number(invoice.total);
    if (!(invoiceTotal > 0)) {
      return NextResponse.json(
        { error: "Invalid invoice total" },
        { status: 400 }
      );
    }

    // Same fee source as pay page (company from resolve)
    const feeSettings = normalizeFeeSettings(company);
    const pass = computeCardPassThrough(invoiceTotal, feeSettings);

    const originResult = getCheckoutOrigin();
    if (!originResult.ok) {
      return NextResponse.json({ error: originResult.error }, { status: 500 });
    }
    const origin = originResult.origin;

    // Expire other open sessions for this invoice (prevent double charge)
    await expireOpenCheckoutSessionsForInvoice(invoice.id);

    const lineItems: {
      quantity: number;
      price_data: {
        currency: string;
        unit_amount: number;
        product_data: { name: string; description?: string };
      };
    }[] = [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pass.invoiceCents,
          product_data: {
            name: `Invoice ${invoice.invoice_number}`,
            description: `Payment for ${invoice.invoice_number}`,
          },
        },
      },
    ];

    if (pass.feeCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pass.feeCents,
          product_data: {
            name: "Card processing fee",
            description:
              "Covers card processing so the invoice is paid in full",
          },
        },
      });
    }

    const safeToken = encodeURIComponent(token);
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customer.email || undefined,
      line_items: lineItems,
      metadata: {
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        invoice_number: invoice.invoice_number,
        payment_link: "guest",
        invoice_amount: String(pass.invoiceAmount),
        fee_amount: String(pass.feeAmount),
        charge_total: String(pass.chargeTotal),
      },
      success_url: `${origin}/pay/${safeToken}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pay/${safeToken}?canceled=1`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 500 }
      );
    }

    const anon = createAnon(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error: pendingError } = await anon.rpc(
      "upsert_stripe_checkout_pending",
      {
        p_token_hash: tokenHash || hashPaymentToken(token),
        p_checkout_session_id: session.id,
        p_currency: "usd",
      }
    );
    if (pendingError) {
      console.error("pending payment log failed", pendingError.message);
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      invoiceAmount: pass.invoiceAmount,
      feeAmount: pass.feeAmount,
      chargeTotal: pass.chargeTotal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
