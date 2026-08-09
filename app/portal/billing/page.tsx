import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePortalContext } from "@/lib/data/portal-context";
import { getCustomerBalance } from "@/lib/data/balances";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/types/database";
import { PortalPayInvoiceButton } from "@/components/portal/portal-pay-invoice-button";
import { isStripeConfigured } from "@/lib/stripe/server";

export default async function PortalBillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    paid?: string;
    canceled?: string;
  }>;
}) {
  const [{ customer }, params] = await Promise.all([
    requirePortalContext(),
    searchParams,
  ]);
  const filter = params.filter;
  const show = filter === "paid" ? "paid" : filter === "all" ? "all" : "open";
  const supabase = await createClient();
  const stripeReady = isStripeConfigured();

  const [balance, invoiceResult] = customer
    ? await Promise.all([
        getCustomerBalance(customer.id),
        supabase
          .from("invoices")
          .select(
            "id, invoice_number, status, total, issue_date, due_date, customer_id"
          )
          .eq("customer_id", customer.id)
          .order("issue_date", { ascending: false }),
      ])
    : [null, { data: [] as Invoice[] }];
  const invoices = invoiceResult.data;

  const list = ((invoices as Invoice[] | null) ?? []).filter((inv) => {
    if (show === "open") return inv.status === "sent" || inv.status === "overdue";
    if (show === "paid") return inv.status === "paid";
    return inv.status !== "draft";
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          Billing & invoices
        </h1>
        <p className="text-sm text-muted-foreground">
          Check your balance, download PDFs, and pay open invoices online.
        </p>
      </div>

      {params.paid === "1" ? (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          Payment submitted. It may take a moment for the invoice to show as
          paid.
        </div>
      ) : null}
      {params.canceled === "1" ? (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Checkout canceled. You can try again anytime.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Balance due</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(balance?.openTotal ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Overdue</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(balance?.overdueTotal ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Open invoices</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {balance?.openCount ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-[3px] w-fit">
        {(
          [
            ["open", "Open"],
            ["paid", "Paid"],
            ["all", "All"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={`/portal/billing?filter=${value}`}
            className={cn(
              "inline-flex h-7 items-center rounded-md px-3 text-sm font-medium",
              show === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Invoices</CardTitle>
          <CardDescription className="text-xs">
            {customer
              ? `Billing for ${customer.name}`
              : "No customer linked yet"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0">
          {list.length ? (
            list.map((invoice) => {
              const payable =
                invoice.status === "sent" || invoice.status === "overdue";
              return (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {invoice.invoice_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(invoice.issue_date)}
                      {invoice.due_date
                        ? ` · Due ${formatDate(invoice.due_date)}`
                        : ""}{" "}
                      · {formatCurrency(invoice.total)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">
                      {titleCase(invoice.status)}
                    </Badge>
                    <Link
                      href={`/invoice-pdf/${invoice.id}`}
                      className={cn(
                        buttonVariants({ size: "sm", variant: "outline" })
                      )}
                    >
                      PDF
                    </Link>
                    {payable && stripeReady ? (
                      <PortalPayInvoiceButton invoiceId={invoice.id} />
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              No invoices in this view.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
