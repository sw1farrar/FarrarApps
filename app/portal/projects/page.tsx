import Link from "next/link";
import { PortalBriefForm } from "@/components/portal/portal-brief-form";
import { PortalProjectsClient } from "@/components/portal/portal-projects-client";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePortalContext } from "@/lib/data/portal-context";
import { getProjectUnreadCounts } from "@/lib/data/messaging";
import { createClient } from "@/lib/supabase/server";
import { titleCase } from "@/lib/format";
import type { Project } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export default async function PortalProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ customer }, params] = await Promise.all([
    requirePortalContext(),
    searchParams,
  ]);
  const showBrief = params.new === "1";
  const supabase = await createClient();

  const { data: projects } = customer
    ? await supabase
        .from("projects")
        .select("id, name, status, updated_at, customer_id, created_at")
        .eq("customer_id", customer.id)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const list = (projects as Project[] | null) ?? [];
  const unread = await getProjectUnreadCounts(list.map((p) => p.id));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">
          Review active work, message Farrar Apps, and submit a new brief when
          you need something built.
        </p>
      </div>

      {customer ? (
        <PortalProjectsClient defaultOpen={showBrief}>
          <PortalBriefForm customerId={customer.id} />
        </PortalProjectsClient>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your account is not linked to a customer yet, so briefs cannot be
          submitted.
        </p>
      )}

      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Your projects</CardTitle>
          <CardDescription className="text-xs">
            Open a project to message and review files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0">
          {list.length ? (
            list.map((project) => {
              const count = unread[project.id] || 0;
              return (
                <Link
                  key={project.id}
                  href={`/portal/projects/${project.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {project.name}
                      {count > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
                          {count}
                        </span>
                      ) : null}
                    </p>
                    {project.scope ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {project.scope}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("shrink-0", count > 0 && "ring-1 ring-foreground/20")}
                  >
                    {titleCase(project.status)}
                  </Badge>
                </Link>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
