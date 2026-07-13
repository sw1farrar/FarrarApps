import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import type { Customer, Invoice, Project } from "@/lib/types/database";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { DeleteCustomerButton } from "@/components/customers/delete-customer-button";
import { InvitePortalButton } from "@/components/customers/invite-portal-button";
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
    .select("*")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const [{ data: projects }, { data: invoices }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("customer_id", id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("*")
      .eq("customer_id", id)
      .order("issue_date", { ascending: false }),
  ]);

  const typedCustomer = customer as Customer;
  const typedProjects = (projects ?? []) as Project[];
  const typedInvoices = (invoices ?? []) as Invoice[];

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
          <h1 className="text-lg font-semibold tracking-tight">
            {typedCustomer.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[typedCustomer.company, typedCustomer.email, typedCustomer.phone]
              .filter(Boolean)
              .join(" · ") || "No contact details"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <InvitePortalButton customer={typedCustomer} />
          <CustomerFormDialog
            customer={typedCustomer}
            trigger={<Button variant="outline" size="sm">Edit</Button>}
          />
          <DeleteCustomerButton customerId={typedCustomer.id} />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="shadow-none lg:col-span-1">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 text-sm text-muted-foreground whitespace-pre-wrap">
            {typedCustomer.notes || "No notes yet."}
          </CardContent>
        </Card>

        <Card className="shadow-none lg:col-span-1">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Projects</CardTitle>
            <CardDescription className="text-xs">
              {typedProjects.length} linked
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {typedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            ) : (
              typedProjects.slice(0, 6).map((project) => (
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
            <Link
              href={`/projects/new?customerId=${typedCustomer.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
            >
              New project
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-none lg:col-span-1">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Invoices</CardTitle>
            <CardDescription className="text-xs">
              {typedInvoices.length} linked
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {typedInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              typedInvoices.slice(0, 6).map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/invoices/${invoice.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted/40"
                >
                  <span className="font-medium">{invoice.invoice_number}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(invoice.total)} · {formatDate(invoice.issue_date)}
                  </span>
                </Link>
              ))
            )}
            <Link
              href={`/invoices/new?customerId=${typedCustomer.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
            >
              New invoice
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
