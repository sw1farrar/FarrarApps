import { redirect } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PortalBriefForm } from "@/components/portal/portal-brief-form";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { linkPortalUserBySessionCustomer } from "@/lib/data/portal";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import type { Invoice, Project } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export default async function PortalPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "client") redirect("/dashboard");

  await linkPortalUserBySessionCustomer();

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name")
    .eq("portal_user_id", profile.id)
    .maybeSingle();

  const [{ data: invoices }, { data: projects }] = customer
    ? await Promise.all([
        supabase
          .from("invoices")
          .select("*")
          .eq("customer_id", customer.id)
          .order("issue_date", { ascending: false }),
        supabase
          .from("projects")
          .select("*")
          .eq("customer_id", customer.id)
          .order("updated_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  async function signOut() {
    "use server";
    const client = await createClient();
    await client.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/farrar_apps_logo.png"
            alt="Farrar Apps"
            className="h-11 w-auto max-w-[12rem] object-contain"
          />
          <span className="text-xs text-muted-foreground">Client Portal</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle userId={profile.id} />
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Welcome, {profile.full_name || profile.email}
          </h1>
          <p className="text-sm text-muted-foreground">
            {customer
              ? `Linked as ${customer.name}`
              : "Your account is not linked to a customer record yet. Ask Farrar Apps to connect you."}
          </p>
        </div>

        {customer && <PortalBriefForm customerId={customer.id} />}

        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm">Invoices</CardTitle>
              <CardDescription className="text-xs">
                View and download PDFs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {(invoices as Invoice[] | null)?.length ? (
                (invoices as Invoice[]).map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                  >
                    <div>
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(invoice.issue_date)} ·{" "}
                        {formatCurrency(invoice.total)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No invoices yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm">Projects</CardTitle>
              <CardDescription className="text-xs">
                Status of active work
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {(projects as Project[] | null)?.length ? (
                (projects as Project[]).map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm"
                  >
                    <span className="font-medium">{project.name}</span>
                    <Badge variant="secondary">
                      {titleCase(project.status)}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No projects yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
