import Link from "next/link";
import { resolvePaymentLink } from "@/lib/invoices/payment-link";
import { computeCardPassThrough, normalizeFeeSettings } from "@/lib/stripe/fee";
import { formatCurrency, formatDate } from "@/lib/format";
import { GuestPayButton } from "@/components/pay/guest-pay-button";

export default async function GuestPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { token } = await params;
  const { canceled } = await searchParams;
  const resolved = await resolvePaymentLink(token);

  if (!resolved.ok) {
    return (
      <PublicShell companyName="Farrar Apps">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <BrandHeader
            companyName="Farrar Apps"
            logoUrl="/farrar_apps_logo.png"
          />
          <div className="p-6 text-center sm:p-8">
            <h1 className="text-lg font-semibold">Payment link unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{resolved.error}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Contact the company that sent this invoice for a new link.
            </p>
          </div>
        </div>
      </PublicShell>
    );
  }

  const { data } = resolved;
  const { invoice, customer, lines, company, logoUrl, payable, reason } = data;
  const companyName = company?.name || "Farrar Apps";
  const feeSettings = normalizeFeeSettings(company);
  const pass = computeCardPassThrough(Number(invoice.total), feeSettings);
  const showFee = payable && pass.feeCents > 0;
  const brandLogo = logoUrl || "/farrar_apps_logo.png";

  return (
    <PublicShell companyName={companyName}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <BrandHeader companyName={companyName} logoUrl={brandLogo} />

        <div className="space-y-5 p-6 sm:p-8">
          {canceled === "1" ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-center text-sm text-muted-foreground">
              Payment was canceled. You can try again below.
            </p>
          ) : null}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Invoice
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight">
              {invoice.invoice_number}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              For {customer.name}
              {customer.company ? ` · ${customer.company}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              Issued {formatDate(invoice.issue_date)} · Due{" "}
              {formatDate(invoice.due_date)}
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Invoice</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(pass.invoiceAmount)}
              </span>
            </div>
            {showFee ? (
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  Card processing fee
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(pass.feeAmount)}
                </span>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
              <span className="text-sm font-medium">
                {showFee ? "Total charged" : "Amount due"}
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {formatCurrency(pass.chargeTotal)}
              </span>
            </div>
          </div>

          {lines.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr
                      key={line.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2">{line.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="flex flex-col items-stretch gap-2 sm:items-center">
            {payable ? (
              <>
                <GuestPayButton
                  token={token}
                  label={
                    showFee
                      ? `Pay ${formatCurrency(pass.chargeTotal)}`
                      : "Pay with card"
                  }
                />
                <p className="max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
                  After payment, we will email you a receipt with the invoice
                  PDF and a full breakdown of charges
                  {showFee ? ", including the card processing fee" : ""}.
                </p>
              </>
            ) : (
              <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-center text-sm">
                {reason || "This invoice cannot be paid online."}
              </p>
            )}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

function BrandHeader({
  companyName,
  logoUrl,
}: {
  companyName: string;
  logoUrl: string;
}) {
  return (
    <div className="border-b border-border bg-background px-6 py-7 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={companyName}
        className="mx-auto h-16 w-auto max-w-[300px] object-contain"
      />
      <p className="mt-3 text-base font-semibold tracking-tight text-foreground">
        {companyName}
      </p>
    </div>
  );
}

function PublicShell({
  children,
  companyName,
}: {
  children: React.ReactNode;
  companyName: string;
}) {
  return (
    <div className="min-h-dvh bg-[#f7f7f4] px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-lg">{children}</div>
      <p className="mt-8 text-center text-[11px] text-muted-foreground">
        <Link href="/" className="hover:underline">
          {companyName}
        </Link>
      </p>
    </div>
  );
}
