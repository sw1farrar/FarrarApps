import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import type {
  Customer,
  Invoice,
  Project,
  ProjectFile,
  ProjectMilestone,
  Transaction,
} from "@/lib/types/database";
import { titleCase } from "@/lib/format";
import { DeleteProjectButton } from "@/components/projects/delete-project-button";
import { ProjectContextPanel } from "@/components/projects/project-context-panel";
import { ProjectDetailWorkspace } from "@/components/projects/project-detail-workspace";
import { ProjectMessaging } from "@/components/projects/project-messaging";
import {
  getThreadUnreadCounts,
  listProjectThreads,
} from "@/lib/data/messaging";
import { Badge } from "@/components/ui/badge";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ thread?: string }>;
}) {
  const { id } = await params;
  const { thread: threadParam } = await searchParams;
  const supabase = await createClient();

  const [profile, { data: project }] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("projects")
      .select(
        "id, customer_id, name, scope, status, created_by, created_at, updated_at, customers(id, name)"
      )
      .eq("id", id)
      .single(),
  ]);

  if (!project) notFound();

  const [
    { data: customers },
    { data: files },
    { data: milestones },
    { data: invoices },
    { data: transactions },
    threads,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, company, email")
      .order("name"),
    supabase
      .from("project_files")
      .select("id, storage_path, file_name")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_milestones")
      .select("id, title, due_date, completed_at")
      .eq("project_id", id)
      .order("sort_order"),
    supabase
      .from("invoices")
      .select("id, invoice_number, total, status, due_date")
      .eq("project_id", id)
      .order("issue_date", { ascending: false }),
    supabase
      .from("transactions")
      .select("id, description, type, amount, date")
      .eq("project_id", id)
      .order("date", { ascending: false }),
    listProjectThreads(id),
  ]);

  const threadUnread = await getThreadUnreadCounts(threads.map((t) => t.id));
  const threadsWithUnread = threads.map((t) => ({
    ...t,
    unread: threadUnread[t.id] || 0,
  }));

  const typed = project as unknown as Project;

  const context = (
    <ProjectContextPanel
      project={typed}
      customers={(customers ?? []) as Customer[]}
      files={(files ?? []) as ProjectFile[]}
      milestones={(milestones ?? []) as ProjectMilestone[]}
      invoices={(invoices ?? []) as Invoice[]}
      transactions={(transactions ?? []) as Transaction[]}
      compact
    />
  );

  return (
    <div
      className={
        // Fill the main area under the app header; no page-level scroll
        "-mx-3 -mt-3 -mb-3 flex h-[calc(100dvh-3rem)] flex-col overflow-hidden sm:-mx-4 sm:-mt-4 sm:-mb-4 sm:h-[calc(100dvh-3.5rem)]"
      }
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href="/projects"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Projects
          </Link>
          <span className="text-xs text-border">/</span>
          <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
            {typed.name}
          </h1>
          <Badge variant="secondary" className="text-[10px]">
            {titleCase(typed.status)}
          </Badge>
          {typed.customers?.name ? (
            <span className="truncate text-xs text-muted-foreground">
              · {typed.customers.name}
            </span>
          ) : null}
        </div>
        <DeleteProjectButton projectId={id} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">
        <ProjectDetailWorkspace
          contextTitle={typed.name}
          messaging={
            profile ? (
              <ProjectMessaging
                projectId={id}
                initialThreads={threadsWithUnread}
                currentUserId={profile.id}
                initialThreadId={threadParam}
                className="h-full min-h-0"
                canModerate={
                  profile.role === "owner" || profile.role === "staff"
                }
              />
            ) : null
          }
          context={context}
        />
      </div>
    </div>
  );
}
