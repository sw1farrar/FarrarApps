import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/profile";
import { computeCardPassThrough } from "@/lib/stripe/fee";
import { loadStripeFeeSettings } from "@/lib/stripe/fee-settings";
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

    const body = (await request.json()) as { invoiceId?: string };
    const invoiceId = body.invoiceId?.trim();
    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
    }

    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    if (profile.role !== "client") {
      return NextResponse.json(
        { error: "Portal clients only" },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    // Load invoice first under RLS-ish path, then verify membership for THAT customer
    const { data: invoice } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, status, total, customer_id, issue_date, due_date"
      )
      .eq("id", invoiceId)
      .maybeSingle();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("customer_members")
      .select("customer_id")
      .eq("user_id", profile.id)
      .eq("customer_id", invoice.customer_id)
      .maybeSingle();

    let authorized = Boolean(membership);
    if (!authorized) {
      const { data: legacy } = await supabase
        .from("customers")
        .select("id")
        .eq("id", invoice.customer_id)
        .eq("portal_user_id", profile.id)
        .maybeSingle();
      authorized = Boolean(legacy);
    }

    if (!authorized) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "paid" || invoice.status === "draft") {
      return NextResponse.json(
        { error: "Invoice is not payable" },
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

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, email")
      .eq("id", invoice.customer_id)
      .single();

    const feeSettings = await loadStripeFeeSettings();
    const pass = computeCardPassThrough(invoiceTotal, feeSettings);

    const originResult = getCheckoutOrigin();
    if (!originResult.ok) {
      return NextResponse.json({ error: originResult.error }, { status: 500 });
    }
    const origin = originResult.origin;

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

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: profile.email || customer?.email || undefined,
      line_items: lineItems,
      metadata: {
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        invoice_number: invoice.invoice_number,
        invoice_amount: String(pass.invoiceAmount),
        fee_amount: String(pass.feeAmount),
        charge_total: String(pass.chargeTotal),
      },
      success_url: `${origin}/portal/billing?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/portal/billing?canceled=1`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 500 }
      );
    }

    try {
      const admin = createAdminClient();
      await admin.from("stripe_invoice_payments").upsert(
        {
          invoice_id: invoice.id,
          customer_id: invoice.customer_id,
          checkout_session_id: session.id,
          amount: pass.invoiceAmount,
          charge_amount: pass.chargeTotal,
          fee_amount: pass.feeAmount,
          currency: "usd",
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "checkout_session_id" }
      );
    } catch (e) {
      console.error(
        "portal pending log failed",
        e instanceof Error ? e.message : e
      );
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
