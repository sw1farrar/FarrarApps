import { NextResponse } from "next/server";
import { resolvePaymentLink } from "@/lib/invoices/payment-link";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentReceiptEmail } from "@/lib/email/send-payment-receipt";
import { money2 } from "@/lib/invoices/card-fee-display";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Guest re-send of payment receipt (token-gated, paid invoices only).
 * POST /pay/[token]/email-receipt
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const resolved = await resolvePaymentLink(token);
    if (!resolved.ok) {
      return NextResponse.json({ ok: false, error: "Unavailable" }, { status: 404 });
    }

    const { invoice, customer } = resolved.data;
    if (invoice.status !== "paid") {
      return NextResponse.json(
        { ok: false, error: "Invoice is not paid yet" },
        { status: 400 }
      );
    }

    if (!customer.email) {
      return NextResponse.json(
        { ok: false, error: "No email on file for this customer" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: pay } = await admin
      .from("stripe_invoice_payments")
      .select("amount, fee_amount, charge_amount")
      .eq("invoice_id", invoice.id)
      .eq("status", "succeeded")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const invoiceAmount = money2(Number(pay?.amount ?? invoice.total));
    const feeAmount = money2(Number(pay?.fee_amount ?? 0));
    const chargeAmount = money2(
      Number(pay?.charge_amount ?? invoiceAmount + feeAmount)
    );

    const sent = await sendPaymentReceiptEmail({
      invoiceId: invoice.id,
      invoiceAmount,
      feeAmount,
      chargeAmount,
      paidAt: invoice.paid_at,
      toEmail: customer.email,
    });

    if (!sent.ok) {
      return NextResponse.json(
        { ok: false, error: sent.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Receipt emailed to ${customer.email}`,
    });
  } catch (e) {
    console.error("email-receipt", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { ok: false, error: "Could not email receipt" },
      { status: 500 }
    );
  }
}
