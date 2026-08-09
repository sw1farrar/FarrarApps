import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import type {
  ActivityLog,
  Invoice,
  Project,
  ProjectMilestone,
} from "@/lib/types/database";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ActiveProject = Project & {
  customers?: { id: string; name: string } | null;
};

type MilestoneWithProject = ProjectMilestone & {
  projects?: { id: string; name: string; status?: string } | null;
};

function daysFromToday(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${dateStr}T00:00:00`);
  return Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function renderProjectList(
  projects: ActiveProject[],
  nextByProject: Map<string, ProjectMilestone>,
  emptyLabel: string
) {
  if (projects.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => {
        const next = nextByProject.get(project.id);
        return (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{project.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {project.customers?.name || "No customer"}
                {next
                  ? ` · Next: ${next.title}${
                      next.due_date ? ` (${formatDate(next.due_date)})` : ""
                    }`
                  : ""}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {titleCase(project.status)}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);
  const soonStr = soon.toISOString().slice(0, 10);

  const [
    { data: activeProjects },
    { data: milestones },
    { data: overdueInvoices },
    { data: activity },
    { data: nextMilestones },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, updated_at, customers(id, name)")
      .in("status", ["planning", "in_progress"])
      .order("updated_at", { ascending: false }),
    supabase
      .from("project_milestones")
      .select(
        "id, project_id, title, due_date, completed_at, projects(id, name, status)"
      )
      .is("completed_at", null)
      .not("due_date", "is", null)
      .lte("due_date", soonStr)
      .order("due_date", { ascending: true })
      .limit(20),
    supabase
      .from("invoices")
      .select("id, invoice_number, total, due_date, customers(id, name)")
      .eq("status", "overdue")
      .order("due_date", { ascending: true })
      .limit(6),
    supabase
      .from("activity_logs")
      .select("id, action, entity_type, entity_id, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("project_milestones")
      .select(
        "id, project_id, title, due_date, completed_at, projects!inner(status)"
      )
      .is("completed_at", null)
      .in("projects.status", ["planning", "in_progress"])
      .order("due_date", { ascending: true }),
  ]);

  const typedProjects = (activeProjects ?? []) as unknown as ActiveProject[];
  const planningProjects = typedProjects.filter((p) => p.status === "planning");
  const inProgressProjects = typedProjects.filter(
    (p) => p.status === "in_progress"
  );

  const nextByProject = new Map<string, ProjectMilestone>();
  for (const milestone of (nextMilestones ?? []) as unknown as ProjectMilestone[]) {
    if (!nextByProject.has(milestone.project_id)) {
      nextByProject.set(milestone.project_id, milestone);
    }
  }

  const typedMilestones = (
    (milestones ?? []) as unknown as MilestoneWithProject[]
  )
    .filter((milestone) => {
      const status = milestone.projects?.status;
      return status === "planning" || status === "in_progress";
    })
    .slice(0, 8);
  const typedOverdue = (overdueInvoices ?? []) as unknown as Invoice[];
  const typedActivity = (activity ?? []) as ActivityLog[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/projects/new"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          New project
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <Card className="shadow-none">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">In progress</CardTitle>
                  <CardDescription className="text-xs">
                    {inProgressProjects.length} active
                  </CardDescription>
                </div>
                <Link
                  href="/projects?status=in_progress"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {renderProjectList(
                inProgressProjects,
                nextByProject,
                "No projects in progress."
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">Planning</CardTitle>
                  <CardDescription className="text-xs">
                    {planningProjects.length} in pipeline
                  </CardDescription>
                </div>
                <Link
                  href="/projects?status=planning"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {renderProjectList(
                planningProjects,
                nextByProject,
                "No projects in planning."
              )}
            </CardContent>
          </Card>

          {typedProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
              <p className="text-sm font-medium">No active projects</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start a project to track delivery work here.
              </p>
              <Link
                href="/projects/new"
                className={cn(buttonVariants({ size: "sm" }), "mt-3")}
              >
                New project
              </Link>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <Card className="shadow-none">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm">Needs attention</CardTitle>
              <CardDescription className="text-xs">
                Briefs, milestones, and overdue invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-0">
              {planningProjects.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    New / planning
                  </p>
                  {planningProjects.slice(0, 4).map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted/40"
                    >
                      <span className="font-medium">{project.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {project.customers?.name || "Review brief"}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}

              {typedMilestones.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Milestones due soon
                  </p>
                  {typedMilestones.map((milestone) => {
                    const delta = milestone.due_date
                      ? daysFromToday(milestone.due_date)
                      : null;
                    return (
                      <Link
                        key={milestone.id}
                        href={`/projects/${milestone.project_id}`}
                        className="flex items-start justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {milestone.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {milestone.projects?.name}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-xs",
                            delta !== null && delta < 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                          )}
                        >
                          {milestone.due_date
                            ? formatDate(milestone.due_date)
                            : "—"}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}

              {typedOverdue.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Overdue invoices
                    </p>
                    <Link
                      href="/finance/invoices?status=overdue"
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      View
                    </Link>
                  </div>
                  {typedOverdue.map((invoice) => (
                    <Link
                      key={invoice.id}
                      href={`/finance/invoices/${invoice.id}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted/40"
                    >
                      <span className="font-medium">
                        {invoice.invoice_number}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(invoice.total)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}

              {planningProjects.length === 0 &&
              typedMilestones.length === 0 &&
              typedOverdue.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nothing needs attention right now.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">Recent activity</CardTitle>
                  <CardDescription className="text-xs">
                    Latest workspace events
                  </CardDescription>
                </div>
                <Link
                  href="/activity"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {typedActivity.length ? (
                typedActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border px-2 py-1.5 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {titleCase(item.action)} {item.entity_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {typeof item.meta?.name === "string"
                          ? item.meta.name
                          : typeof item.meta?.invoice_number === "string"
                            ? item.meta.invoice_number
                            : item.entity_id?.slice(0, 8) || ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                  No activity yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
