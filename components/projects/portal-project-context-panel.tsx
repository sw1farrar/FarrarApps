import type { Project, ProjectMilestone } from "@/lib/types/database";
import { formatDate } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PortalFile = {
  id: string;
  file_name: string;
  url: string | null;
};

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border px-3 py-3 last:border-b-0">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function PortalProjectContextPanel({
  project,
  milestones,
  files,
}: {
  project: Project;
  milestones: ProjectMilestone[];
  files: PortalFile[];
}) {
  return (
    <div className="divide-y divide-border">
      {project.scope ? (
        <PanelSection title="Scope">
          <p className="whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
            {project.scope}
          </p>
        </PanelSection>
      ) : null}

      <PanelSection title="Milestones">
        {milestones.length ? (
          <ul className="space-y-1">
            {milestones.map((milestone) => (
              <li
                key={milestone.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-xs"
              >
                <span className="font-medium">{milestone.title}</span>
                <span className="shrink-0 text-muted-foreground">
                  {milestone.completed_at
                    ? `Done ${formatDate(milestone.completed_at)}`
                    : milestone.due_date
                      ? `Due ${formatDate(milestone.due_date)}`
                      : "Open"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No milestones yet.</p>
        )}
      </PanelSection>

      <PanelSection title="Files">
        {files.length ? (
          <ul className="space-y-1">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-xs"
              >
                <span className="truncate font-medium">{file.file_name}</span>
                {file.url ? (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ size: "sm", variant: "outline" }),
                      "h-7 text-[11px]"
                    )}
                  >
                    Download
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No files yet.</p>
        )}
      </PanelSection>
    </div>
  );
}
