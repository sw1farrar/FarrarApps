"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addProjectFileMeta, addProjectMilestone, toggleMilestone } from "@/lib/data/projects";
import type { ProjectFile, ProjectMilestone } from "@/lib/types/database";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export function ProjectFilesPanel({
  projectId,
  files,
}: {
  projectId: string;
  files: ProjectFile[];
}) {
  const router = useRouter();
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(true);
    const supabase = createClient();

    for (const file of Array.from(fileList)) {
      const path = `${projectId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("project-files")
        .upload(path, file, { upsert: false });

      if (error) {
        toast.error(error.message);
        continue;
      }

      const result = await addProjectFileMeta({
        projectId,
        storagePath: path,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      if (!result.ok) toast.error(result.error);
    }

    setUploading(false);
    toast.success("Upload complete");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Files</p>
        <Button
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onFilesSelected(e.target.files)}
        />
      </div>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files uploaded.</p>
      ) : (
        <ul className="space-y-1">
          {files.map((file) => (
            <li
              key={file.id}
              className="rounded-md border border-border px-2 py-1.5 text-sm"
            >
              {file.file_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProjectMilestonesPanel({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: ProjectMilestone[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await addProjectMilestone(projectId, formData);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    e.currentTarget.reset();
    router.refresh();
  }

  async function onToggle(milestone: ProjectMilestone, checked: boolean) {
    const result = await toggleMilestone(milestone.id, projectId, checked);
    if (!result.ok) toast.error(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Milestones</p>
      <form onSubmit={onAdd} className="flex gap-2">
        <Input name="title" placeholder="Milestone title" required />
        <Input name="due_date" type="date" className="w-40" />
        <Button type="submit" size="sm" disabled={pending}>
          Add
        </Button>
      </form>
      <ul className="space-y-2">
        {milestones.map((milestone) => (
          <li
            key={milestone.id}
            className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
          >
            <Checkbox
              checked={Boolean(milestone.completed_at)}
              onCheckedChange={(value) =>
                onToggle(milestone, value === true)
              }
            />
            <span className="flex-1">{milestone.title}</span>
            <span className="text-xs text-muted-foreground">
              {formatDate(milestone.due_date)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
