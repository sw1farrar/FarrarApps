import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { resolvePaymentLink } from "@/lib/invoices/payment-link";
import { applyStripeInvoicePayment } from "@/lib/stripe/apply-payment";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { formatCurrency, formatDate } from "@/lib/format";
import { money2 } from "@/lib/invoices/card-fee-display";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaySuccessActions } from "@/components/pay/pay-success-actions";
import { cn } from "@/lib/utils";

export default async function GuestPaySuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { token } = await params;
  const { session_id: sessionId } = await searchParams;
  const resolved = await resolvePaymentLink(token);

  if (!resolved.ok) {
    return (
      <Shell companyName="Farrar Apps" logoUrl="/farrar_apps_logo.png">
        <IconState tone="error" />
        <h1 className="mt-4 text-lg font-semibold">Link unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This payment page is no longer available.
        </p>
      </Shell>
    );
  }

  const { invoice, company, customer, lines, logoUrl } = resolved.data;
  const companyName = company?.name || "Farrar Apps";
  let state: "paid" | "processing" | "invalid" = "invalid";
  let message = "We could not confirm this payment.";

  // Fee breakdown from Checkout session (authoritative for this payment)
  let invoiceAmount = money2(Number(invoice.total));
  let feeAmount = 0;
  let chargeAmount = invoiceAmount;
  let paidAt: string | null = invoice.paid_at;

  if (!sessionId || !isStripeConfigured()) {
    state =
      resolved.data.payable === false && invoice.status === "paid"
        ? "paid"
        : "invalid";
    if (state === "paid") {
      message = `Payment for ${invoice.invoice_number} is complete.`;
    } else {
      message =
        "Missing payment session. If you paid, wait a moment and refresh.";
    }
  } else {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      const metaInvoiceId = session.metadata?.invoice_id;
      if (metaInvoiceId && metaInvoiceId !== invoice.id) {
        state = "invalid";
        message = "This payment does not match this invoice.";
      } else if (
        session.payment_status === "paid" ||
        session.status === "complete"
      ) {
        const sessionCharge =
          (session.amount_total ?? 0) / 100 ||
          Number(session.amount_subtotal ?? 0) / 100;
        const metaInvoice = Number(session.metadata?.invoice_amount);
        const metaFee = Number(session.metadata?.fee_amount);
        const sessionFee = Number.isFinite(metaFee)
          ? metaFee
          : Number.isFinite(metaInvoice)
            ? Math.max(0, sessionCharge - metaInvoice)
            : Math.max(0, sessionCharge - Number(invoice.total));
        const principal = Number.isFinite(metaInvoice)
          ? metaInvoice
          : Number(invoice.total);

        invoiceAmount = money2(principal);
        feeAmount = money2(sessionFee);
        chargeAmount = money2(sessionCharge || principal + sessionFee);

        await applyStripeInvoicePayment({
          invoiceId: invoice.id,
          customerId: invoice.customer_id,
          chargeAmount,
          feeAmount,
          amount: principal,
          currency: session.currency || "usd",
          checkoutSessionId: session.id,
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          raw: session,
        });
        state = "paid";
        paidAt = new Date().toISOString();
        message = `Thank you. ${invoice.invoice_number} is paid.`;
      } else if (session.status === "open") {
        state = "processing";
        message = "Checkout is still open. Complete payment or try again.";
      } else {
        state = "processing";
        message =
          "Payment is still confirming. This page will show paid once Stripe finishes.";
      }
    } catch {
      if (invoice.status === "paid") {
        state = "paid";
        message = `Thank you. ${invoice.invoice_number} is paid.`;
      } else {
        state = "processing";
        message =
          "Payment submitted. Confirmation may take a few seconds — refresh shortly.";
      }
    }
  }

  const latest = await resolvePaymentLink(token);
  const isPaid =
    state === "paid" ||
    (latest.ok && latest.data.invoice.status === "paid");

  // If paid but we don't have session fee totals, load from DB
  if (isPaid && feeAmount <= 0) {
    try {
      const admin = createAdminClient();
      const { data: pay } = await admin
        .from("stripe_invoice_payments")
        .select("amount, fee_amount, charge_amount")
        .eq("invoice_id", invoice.id)
        .eq("status", "succeeded")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pay) {
        invoiceAmount = money2(Number(pay.amount ?? invoice.total));
        feeAmount = money2(Number(pay.fee_amount ?? 0));
        chargeAmount = money2(
          Number(pay.charge_amount ?? invoiceAmount + feeAmount)
        );
      }
    } catch {
      /* optional */
    }
  }

  const brandLogo = logoUrl || "/farrar_apps_logo.png";
  const displayLines =
    latest.ok && latest.data.lines?.length ? latest.data.lines : lines;
  const displayCustomer =
    latest.ok && latest.data.customer ? latest.data.customer : customer;

  return (
    <Shell companyName={companyName} logoUrl={brandLogo}>
      <IconState
        tone={
          isPaid ? "success" : state === "processing" ? "pending" : "error"
        }
      />
      <h1 className="mt-4 text-lg font-semibold text-[#1a1a1a]">
        {isPaid
          ? "Payment received"
          : state === "processing"
            ? "Confirming payment"
            : "Payment not confirmed"}
      </h1>
      <p className="mt-2 text-sm text-[#555]">{message}</p>

      {isPaid ? (
        <>
          {/* Printable confirmation card */}
          <div
            id="payment-confirmation"
            className="mt-6 rounded-xl border border-[#ecece8] bg-[#fafaf8] px-4 py-4 text-left text-sm text-[#1a1a1a]"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#ecece8] pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                  Payment confirmation
                </p>
                <p className="mt-1 text-base font-semibold">
                  {invoice.invoice_number}
                </p>
                <p className="text-xs text-[#666]">
                  {displayCustomer.name}
                  {displayCustomer.email ? ` · ${displayCustomer.email}` : ""}
                </p>
              </div>
              <div className="text-right text-xs text-[#666]">
                <p className="font-medium text-emerald-700">PAID</p>
                <p>
                  {formatDate(
                    paidAt || invoice.paid_at || new Date().toISOString()
                  )}
                </p>
              </div>
            </div>

            {displayLines.length ? (
              <ul className="mt-3 space-y-1.5 border-b border-[#ecece8] pb-3">
                {displayLines.map((line) => (
                  <li
                    key={line.id}
                    className="flex justify-between gap-3 text-xs"
                  >
                    <span className="min-w-0 truncate text-[#333]">
                      {line.description}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatCurrency(line.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <dl className="mt-3 space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-[#555]">Invoice amount</dt>
                <dd className="tabular-nums font-medium">
                  {formatCurrency(invoiceAmount)}
                </dd>
              </div>
              {feeAmount > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-[#555]">Card processing fee</dt>
                  <dd className="tabular-nums font-medium">
                    {formatCurrency(feeAmount)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3 border-t border-[#ecece8] pt-2 text-base">
                <dt className="font-semibold">Amount paid</dt>
                <dd className="tabular-nums font-bold">
                  {formatCurrency(chargeAmount)}
                </dd>
              </div>
            </dl>

            {feeAmount > 0 ? (
              <p className="mt-3 text-[11px] leading-relaxed text-[#777]">
                The card processing fee of {formatCurrency(feeAmount)} was
                included so the invoice principal of{" "}
                {formatCurrency(invoiceAmount)} is received in full. Total
                charged to your card: {formatCurrency(chargeAmount)}.
              </p>
            ) : null}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-[#666]">
            A receipt with the full invoice PDF
            {feeAmount > 0 ? " (including the card processing fee)" : ""} is
            emailed to {displayCustomer.email || "you"}. You can also print this
            confirmation or download the PDF below.
          </p>

          <PaySuccessActions
            token={token}
            invoiceId={invoice.id}
            customerEmail={displayCustomer.email}
          />
        </>
      ) : (
        <Link
          href={`/pay/${encodeURIComponent(token)}`}
          className="mt-4 inline-block text-xs text-muted-foreground hover:underline"
        >
          Return to invoice
        </Link>
      )}
    </Shell>
  );
}

function Shell({
  children,
  companyName,
  logoUrl,
}: {
  children: React.ReactNode;
  companyName: string;
  logoUrl: string;
}) {
  return (
    <div className="min-h-dvh bg-[#f7f7f4] px-4 py-10 sm:py-14 print:bg-white print:py-4">
      <div
        className={cn(
          "mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
          "print:max-w-none print:border-0 print:shadow-none"
        )}
      >
        <div className="border-b border-border bg-background px-6 py-6 text-center print:border-[#ecece8]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={companyName}
            className="mx-auto h-14 w-auto max-w-[280px] object-contain"
          />
          <p className="mt-2 text-sm font-semibold tracking-tight text-[#1a1a1a]">
            {companyName}
          </p>
        </div>
        <div className="p-6 text-center sm:p-8 print:p-6">{children}</div>
      </div>
    </div>
  );
}

function IconState({
  tone,
}: {
  tone: "success" | "pending" | "error";
}) {
  if (tone === "success") {
    return (
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 print:bg-transparent">
        <CheckCircle2 className="size-6" />
      </div>
    );
  }
  if (tone === "pending") {
    return (
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
        <Clock className="size-6" />
      </div>
    );
  }
  return (
    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
      <XCircle className="size-6" />
    </div>
  );
}
