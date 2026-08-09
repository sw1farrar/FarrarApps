import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomerBalance } from "@/lib/data/balances";
import { formatCurrency } from "@/lib/format";
import type { InvoiceListRow } from "@/components/invoices/invoices-table-client";
import { InvoicesTableClient } from "@/components/invoices/invoices-table-client";
import { InvitePortalButton } from "@/components/customers/invite-portal-button";
import {
  getCustomerMembers,
  getPendingPortalInvites,
} from "@/lib/data/portal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Customer } from "@/lib/types/database";

export default async function FinanceArCustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .maybeSingle();

  if (!customer) notFound();

  const typedCustomer = customer as Customer;

  const [balance, { data: openInvoices }, pendingInvites, members] =
    await Promise.all([
      getCustomerBalance(customerId),
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, status, issue_date, due_date, total, customers(id, name)"
        )
        .eq("customer_id", customerId)
        .in("status", ["sent", "overdue"])
        .order("due_date", { ascending: true }),
      getPendingPortalInvites(customerId),
      getCustomerMembers(customerId),
    ]);

  const invoices = (openInvoices ?? []) as unknown as InvoiceListRow[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/finance/ar" className="hover:underline">
              Accounts receivable
            </Link>{" "}
            / {typedCustomer.name}
          </p>
          <h1 className="text-lg font-semibold tracking-tight">
            {typedCustomer.name}
          </h1>
          {typedCustomer.company ? (
            <p className="text-sm text-muted-foreground">
              {typedCustomer.company}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/customers/${customerId}`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Customer profile
          </Link>
          <Link
            href={`/finance/invoices/new?customerId=${customerId}`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            New invoice
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Open AR</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(balance.openTotal)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Overdue</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(balance.overdueTotal)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Open invoices</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {balance.openCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Aging</CardDescription>
            <CardTitle className="text-xs font-normal leading-relaxed text-muted-foreground">
              Current {formatCurrency(balance.aging.current)}
              <br />
              1–30 {formatCurrency(balance.aging.days30)} · 31–60{" "}
              {formatCurrency(balance.aging.days60)} · 61+{" "}
              {formatCurrency(balance.aging.days90)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div>
        <div className="mb-2">
          <h2 className="text-sm font-medium">Open invoices</h2>
        </div>
        <InvoicesTableClient
          invoices={invoices}
          showCustomer={false}
          emptyMessage="No open invoices for this customer."
        />
      </div>

      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Portal access</CardTitle>
          <CardDescription className="text-xs">
            Give this customer a login to view invoices and projects
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <InvitePortalButton
            customer={typedCustomer}
            pendingInvites={pendingInvites}
            members={members}
          />
        </CardContent>
      </Card>
    </div>
  );
}
