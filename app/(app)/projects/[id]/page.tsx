import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  Customer,
  Invoice,
  Project,
  ProjectFile,
  ProjectMilestone,
  Transaction,
} from "@/lib/types/database";
import { formatCurrency, formatDate } from "@/lib/format";
import { ProjectForm } from "@/components/projects/project-form";
import {
  ProjectFilesPanel,
  ProjectMilestonesPanel,
} from "@/components/projects/project-panels";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, customers(id, name, email)")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const [
    { data: customers },
    { data: files },
    { data: milestones },
    { data: invoices },
    { data: transactions },
  ] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    supabase
      .from("project_files")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_milestones")
      .select("*")
      .eq("project_id", id)
      .order("sort_order"),
    supabase
      .from("invoices")
      .select("*")
      .eq("project_id", id)
      .order("issue_date", { ascending: false }),
    supabase
      .from("transactions")
      .select("*")
      .eq("project_id", id)
      .order("date", { ascending: false }),
  ]);

  const typed = project as Project;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/projects" className="hover:underline">
            Projects
          </Link>{" "}
          / {typed.name}
        </p>
        <h1 className="text-lg font-semibold tracking-tight">{typed.name}</h1>
        <p className="text-sm text-muted-foreground">
          {typed.customers?.name} · updated {formatDate(typed.updated_at)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <ProjectForm
              customers={(customers ?? []) as Customer[]}
              project={typed}
            />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="shadow-none">
            <CardContent className="p-3">
              <ProjectFilesPanel
                projectId={id}
                files={(files ?? []) as ProjectFile[]}
              />
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardContent className="p-3">
              <ProjectMilestonesPanel
                projectId={id}
                milestones={(milestones ?? []) as ProjectMilestone[]}
              />
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm">Linked invoices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-3 pt-0">
              {(invoices as Invoice[] | null)?.length ? (
                (invoices as Invoice[]).map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="flex justify-between rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted/40"
                  >
                    <span>{invoice.invoice_number}</span>
                    <span>{formatCurrency(invoice.total)}</span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">None yet</p>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm">Linked transactions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-3 pt-0">
              {(transactions as Transaction[] | null)?.length ? (
                (transactions as Transaction[]).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex justify-between rounded-md border border-border px-2 py-1.5 text-sm"
                  >
                    <span>{tx.description || tx.type}</span>
                    <span>{formatCurrency(tx.amount)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">None yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
