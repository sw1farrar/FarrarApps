import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ProjectDetailWorkspace } from "@/components/projects/project-detail-workspace";
import { ProjectMessaging } from "@/components/projects/project-messaging";
import { PortalProjectContextPanel } from "@/components/projects/portal-project-context-panel";
import { requirePortalContext } from "@/lib/data/portal-context";
import {
  getThreadUnreadCounts,
  listProjectThreads,
} from "@/lib/data/messaging";
import { createClient } from "@/lib/supabase/server";
import { titleCase } from "@/lib/format";
import type {
  Project,
  ProjectFile,
  ProjectMilestone,
} from "@/lib/types/database";

export default async function PortalProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ thread?: string }>;
}) {
  const { id } = await params;
  const { thread: threadParam } = await searchParams;
  const { profile, customer } = await requirePortalContext();
  if (!customer) notFound();

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (!project) notFound();

  const typed = project as Project;
  const threads = await listProjectThreads(id);
  const [threadUnread, { data: files }, { data: milestones }] =
    await Promise.all([
      getThreadUnreadCounts(threads.map((x) => x.id)),
      supabase
        .from("project_files")
        .select("id, file_name, storage_path, created_at, size_bytes")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_milestones")
        .select("id, title, due_date, completed_at, sort_order")
        .eq("project_id", id)
        .order("sort_order"),
    ]);

  const threadsWithUnread = threads.map((t) => ({
    ...t,
    unread: threadUnread[t.id] || 0,
  }));

  const fileRows = (files as ProjectFile[] | null) ?? [];
  const milestoneRows = (milestones as ProjectMilestone[] | null) ?? [];

  const signedFiles = await Promise.all(
    fileRows.map(async (file) => {
      const { data } = await supabase.storage
        .from("project-files")
        .createSignedUrl(file.storage_path, 60 * 30);
      return { ...file, url: data?.signedUrl ?? null };
    })
  );

  const context = (
    <PortalProjectContextPanel
      project={typed}
      milestones={milestoneRows}
      files={signedFiles}
    />
  );

  return (
    <div className="-mx-3 -mt-3 -mb-3 flex h-[calc(100dvh-3rem)] flex-col overflow-hidden sm:-mx-4 sm:-mt-4 sm:-mb-4 sm:h-[calc(100dvh-3.5rem)]">
      <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-2 sm:px-4">
        <Link
          href="/portal/projects"
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
      </header>

      <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">
        <ProjectDetailWorkspace
          contextTitle={typed.name}
          messaging={
            <ProjectMessaging
              projectId={id}
              initialThreads={threadsWithUnread}
              currentUserId={profile.id}
              initialThreadId={threadParam}
              className="h-full min-h-0"
              contextHint="Conversation with Farrar Apps"
            />
          }
          context={context}
        />
      </div>
    </div>
  );
}
