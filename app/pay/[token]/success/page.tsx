import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { resolvePaymentLink } from "@/lib/invoices/payment-link";
import { applyStripeInvoicePayment } from "@/lib/stripe/apply-payment";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { formatCurrency } from "@/lib/format";

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

  const { invoice, company } = resolved.data;
  const companyName = company?.name || "Farrar Apps";
  let state: "paid" | "processing" | "invalid" = "invalid";
  let message = "We could not confirm this payment.";

  if (!sessionId || !isStripeConfigured()) {
    state = resolved.data.payable === false && invoice.status === "paid"
      ? "paid"
      : "invalid";
    if (state === "paid") {
      message = `Payment for ${invoice.invoice_number} (${formatCurrency(invoice.total)}) is complete.`;
    } else {
      message = "Missing payment session. If you paid, wait a moment and refresh.";
    }
  } else {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      const metaInvoice = session.metadata?.invoice_id;
      if (metaInvoice && metaInvoice !== invoice.id) {
        state = "invalid";
        message = "This payment does not match this invoice.";
      } else if (
        session.payment_status === "paid" ||
        session.status === "complete"
      ) {
        // Idempotent apply if webhook is delayed (align fee math with webhook)
        const chargeAmount =
          (session.amount_total ?? 0) / 100 ||
          Number(session.amount_subtotal ?? 0) / 100;
        const metaInvoice = Number(session.metadata?.invoice_amount);
        const metaFee = Number(session.metadata?.fee_amount);
        const feeAmount = Number.isFinite(metaFee)
          ? metaFee
          : Number.isFinite(metaInvoice)
            ? Math.max(0, chargeAmount - metaInvoice)
            : Math.max(0, chargeAmount - Number(invoice.total));
        const principal = Number.isFinite(metaInvoice)
          ? metaInvoice
          : Number(invoice.total);

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
        message = `Thank you. ${invoice.invoice_number} (${formatCurrency(invoice.total)}) is paid.`;
      } else if (session.status === "open") {
        state = "processing";
        message = "Checkout is still open. Complete payment or try again.";
      } else {
        state = "processing";
        message =
          "Payment is still confirming. This page will show paid once Stripe finishes.";
      }
    } catch {
      // Fall back to invoice status after webhook
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

  // Re-resolve for latest paid flag after apply
  const latest = await resolvePaymentLink(token);
  const isPaid =
    state === "paid" ||
    (latest.ok && latest.data.invoice.status === "paid");

  const brandLogo = resolved.ok
    ? resolved.data.logoUrl || "/farrar_apps_logo.png"
    : "/farrar_apps_logo.png";

  return (
    <Shell companyName={companyName} logoUrl={brandLogo}>
      <IconState
        tone={
          isPaid ? "success" : state === "processing" ? "pending" : "error"
        }
      />
      <h1 className="mt-4 text-lg font-semibold">
        {isPaid
          ? "Payment received"
          : state === "processing"
            ? "Confirming payment"
            : "Payment not confirmed"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {isPaid ? (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          A receipt with the invoice PDF and all charges has been emailed to
          you. You can close this window.
        </p>
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
    <div className="min-h-dvh bg-[#f7f7f4] px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-background px-6 py-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={companyName}
            className="mx-auto h-14 w-auto max-w-[280px] object-contain"
          />
          <p className="mt-2 text-sm font-semibold tracking-tight">
            {companyName}
          </p>
        </div>
        <div className="p-6 text-center sm:p-8">{children}</div>
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
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
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
