import Link from "next/link";
import { FolderKanban, Receipt, FilePlus2, ArrowRight } from "lucide-react";
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
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Invoice, Project } from "@/lib/types/database";

export default async function PortalHomePage() {
  const { profile, customer } = await requirePortalContext();
  const supabase = await createClient();

  const [
    { data: invoices },
    { data: projects },
    { count: projectCount },
    { count: invoiceCount },
  ] = customer
    ? await Promise.all([
        supabase
          .from("invoices")
          .select("*")
          .eq("customer_id", customer.id)
          .order("issue_date", { ascending: false })
          .limit(5),
        supabase
          .from("projects")
          .select("*")
          .eq("customer_id", customer.id)
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", customer.id),
        supabase
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", customer.id),
      ])
    : [
        { data: [] },
        { data: [] },
        { count: 0 },
        { count: 0 },
      ];

  const projectList = (projects as Project[] | null) ?? [];
  const invoiceList = (invoices as Invoice[] | null) ?? [];
  const totalProjects = projectCount ?? 0;
  const totalInvoices = invoiceCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Welcome, {profile.full_name || profile.email}
          </h1>
          <p className="text-sm text-muted-foreground">
            {customer
              ? `Signed in for ${customer.name}${
                  customer.company ? ` · ${customer.company}` : ""
                }`
              : "Your account is not linked to a customer record yet. Ask Farrar Apps to connect you."}
          </p>
        </div>
        {customer ? (
          <Link
            href="/portal/projects?new=1"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <FilePlus2 className="size-4" />
            Submit a brief
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/portal/projects"
          className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <FolderKanban className="size-4 text-muted-foreground" />
            Projects
            <ArrowRight className="ml-auto size-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {totalProjects}
          </p>
          <p className="text-xs text-muted-foreground">
            Track status and submit new briefs
          </p>
        </Link>
        <Link
          href="/portal/billing"
          className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Receipt className="size-4 text-muted-foreground" />
            Billing
            <ArrowRight className="ml-auto size-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {totalInvoices}
          </p>
          <p className="text-xs text-muted-foreground">
            View invoices and download PDFs
          </p>
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
            <div>
              <CardTitle className="text-sm">Recent projects</CardTitle>
              <CardDescription className="text-xs">
                Latest work for your account
              </CardDescription>
            </div>
            <Link
              href="/portal/projects"
              className={cn(
                buttonVariants({ size: "sm", variant: "ghost" }),
                "h-7 px-2 text-xs"
              )}
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {projectList.length ? (
              projectList.map((project) => (
                <Link
                  key={project.id}
                  href={`/portal/projects/${project.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="truncate font-medium">{project.name}</span>
                  <Badge variant="secondary">{titleCase(project.status)}</Badge>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No projects yet.{" "}
                {customer ? (
                  <Link
                    href="/portal/projects?new=1"
                    className="underline underline-offset-2"
                  >
                    Submit a brief
                  </Link>
                ) : null}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
            <div>
              <CardTitle className="text-sm">Recent invoices</CardTitle>
              <CardDescription className="text-xs">
                Billing activity
              </CardDescription>
            </div>
            <Link
              href="/portal/billing"
              className={cn(
                buttonVariants({ size: "sm", variant: "ghost" }),
                "h-7 px-2 text-xs"
              )}
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {invoiceList.length ? (
              invoiceList.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {invoice.invoice_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(invoice.issue_date)} ·{" "}
                      {formatCurrency(invoice.total)}
                    </p>
                  </div>
                  <Badge variant="secondary">{titleCase(invoice.status)}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
