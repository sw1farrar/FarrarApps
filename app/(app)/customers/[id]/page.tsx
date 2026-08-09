import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import type { Customer, Invoice, Project } from "@/lib/types/database";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { DeleteCustomerButton } from "@/components/customers/delete-customer-button";
import { InvitePortalButton } from "@/components/customers/invite-portal-button";
import {
  getCustomerMembers,
  getPendingPortalInvites,
} from "@/lib/data/portal";
import { derivePortalAccessStatus } from "@/lib/data/portal-status";
import { getCustomerBalance } from "@/lib/data/balances";
import { PortalStatusBadge } from "@/components/customers/portal-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, name, email, phone, company, address, city, state, zip, notes, portal_user_id"
    )
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const [
    { data: projects },
    { data: invoices },
    pendingInvites,
    members,
    balance,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, updated_at")
      .eq("customer_id", id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total, issue_date")
      .eq("customer_id", id)
      .order("issue_date", { ascending: false }),
    getPendingPortalInvites(id),
    getCustomerMembers(id),
    getCustomerBalance(id),
  ]);

  const typedCustomer = customer as Customer;
  const typedProjects = (projects ?? []) as Project[];
  const typedInvoices = (invoices ?? []) as Invoice[];
  const portalStatus = derivePortalAccessStatus({
    memberCount: members?.length ?? 0,
    pendingInviteCount: pendingInvites?.length ?? 0,
    portalUserId: typedCustomer.portal_user_id,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/customers" className="hover:underline">
              Customers
            </Link>{" "}
            / {typedCustomer.name}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">
              {typedCustomer.name}
            </h1>
            <PortalStatusBadge status={portalStatus} />
          </div>
          <p className="text-sm text-muted-foreground">
            {[typedCustomer.company, typedCustomer.email, typedCustomer.phone]
              .filter(Boolean)
              .join(" · ") || "No contact details"}
          </p>
          {[typedCustomer.address, typedCustomer.city, typedCustomer.state, typedCustomer.zip]
            .some(Boolean) ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {[
                typedCustomer.address,
                [typedCustomer.city, typedCustomer.state]
                  .filter(Boolean)
                  .join(", "),
                typedCustomer.zip,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <CustomerFormDialog
            customer={typedCustomer}
            trigger={
              <Button variant="outline" size="sm">
                Edit
              </Button>
            }
          />
          <DeleteCustomerButton customerId={typedCustomer.id} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Balance due</CardDescription>
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
      </div>

      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Portal access</CardTitle>
          <CardDescription className="text-xs">
            Optional. Invite when they need project chat and portal billing —
            customers can still receive invoices and pay without a portal.
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

      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Notes</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-sm text-muted-foreground whitespace-pre-wrap">
          {typedCustomer.notes || "No notes yet."}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm">Projects</CardTitle>
                <CardDescription className="text-xs">
                  {typedProjects.length} linked
                </CardDescription>
              </div>
              <Link
                href={`/projects/new?customerId=${typedCustomer.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                New project
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {typedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            ) : (
              typedProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted/40"
                >
                  <span className="truncate font-medium">{project.name}</span>
                  <Badge variant="secondary">{titleCase(project.status)}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="p-3 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm">Invoices</CardTitle>
                <CardDescription className="text-xs">
                  {typedInvoices.length} linked
                </CardDescription>
              </div>
              <Link
                href={`/finance/invoices/new?customerId=${typedCustomer.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                New invoice
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {typedInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              typedInvoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/finance/invoices/${invoice.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{invoice.invoice_number}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {titleCase(invoice.status)}
                    </span>
                  </div>
                  <span className="shrink-0 text-muted-foreground">
                    {formatCurrency(invoice.total)} ·{" "}
                    {formatDate(invoice.issue_date)}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
