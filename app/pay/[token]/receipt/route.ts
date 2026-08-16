import { NextResponse } from "next/server";
import { resolvePaymentLink } from "@/lib/invoices/payment-link";
import { cardFeeDisplayFromPayment } from "@/lib/invoices/card-fee-display";
import { renderInvoicePdfBuffer } from "@/lib/pdf/render-invoice-pdf";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Guest-accessible paid invoice PDF (token-gated).
 * GET /pay/[token]/receipt
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const resolved = await resolvePaymentLink(token);
    if (!resolved.ok) {
      return NextResponse.json({ error: "Unavailable" }, { status: 404 });
    }

    const { invoice, customer, lines, company, logoUrl } = resolved.data;

    // Prefer Stripe payment row for fee totals; fall back to invoice only
    let cardFee = null as ReturnType<typeof cardFeeDisplayFromPayment>;
    try {
      const admin = createAdminClient();
      const { data: pay } = await admin
        .from("stripe_invoice_payments")
        .select("amount, fee_amount, charge_amount, status")
        .eq("invoice_id", invoice.id)
        .eq("status", "succeeded")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      cardFee = cardFeeDisplayFromPayment({
        invoiceTotal: Number(invoice.total),
        paidAt: invoice.paid_at,
        amount: pay?.amount ?? invoice.total,
        feeAmount: pay?.fee_amount ?? 0,
        chargeAmount: pay?.charge_amount ?? null,
      });
    } catch {
      // Admin unavailable — PDF without fee lines still ok
      cardFee = null;
    }

    const logoSrc =
      logoUrl ||
      `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://farrarapps.com"}/farrar_apps_logo.png`;

    const buffer = await renderInvoicePdfBuffer({
      invoice,
      lines,
      customer,
      company,
      logoSrc,
      cardFee,
      includeCardRemittance: true,
    });

    const body = new Uint8Array(buffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoice_number}-receipt.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("pay receipt pdf", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Could not generate receipt PDF" },
      { status: 500 }
    );
  }
}
