import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listSavedViews } from "@/lib/data/saved-views";
import { getProjectUnreadCounts } from "@/lib/data/messaging";
import { formatDate, titleCase } from "@/lib/format";
import type { Project, ProjectStatus, SavedView } from "@/lib/types/database";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ListFilters } from "@/components/filters/list-filters";
import { SavedViewsBar } from "@/components/filters/saved-views-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status?.trim() ?? "";
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select("id, name, status, updated_at, customers(id, name)")
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status as ProjectStatus);
  if (q) {
    const pattern = `%${q.replace(/[%_,]/g, "")}%`;
    query = query.ilike("name", pattern);
  }

  const [{ data }, savedViews] = await Promise.all([
    query,
    listSavedViews("projects"),
  ]);

  const projects = (data ?? []) as unknown as Project[];
  const unread = await getProjectUnreadCounts(projects.map((p) => p.id));

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

      <div className="space-y-2">
        <ListFilters
          placeholder="Search projects"
          statusOptions={[
            { value: "planning", label: "Planning" },
            { value: "in_progress", label: "In Progress" },
            { value: "delivered", label: "Delivered" },
            { value: "archived", label: "Archived" },
          ]}
        />
        <SavedViewsBar entity="projects" views={savedViews as SavedView[]} />
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center">
          <p className="text-sm font-medium">No projects yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a project linked to a customer to track delivery.
          </p>
          <div className="mt-4 flex justify-center">
            <Link
              href="/projects/new"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              New project
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                const count = unread[project.id] || 0;
                return (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link
                        href={`/projects/${project.id}`}
                        className="inline-flex items-center gap-2 font-medium hover:underline"
                      >
                        {project.name}
                        {count > 0 ? (
                          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
                            {count}
                          </span>
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {project.customers?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {titleCase(project.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatDate(project.updated_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
