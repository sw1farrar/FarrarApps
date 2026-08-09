"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  addProjectFileMeta,
  addProjectMilestone,
  deleteProjectFile,
  deleteProjectMilestone,
  getProjectFileSignedUrl,
  toggleMilestone,
} from "@/lib/data/projects";
import type { ProjectFile, ProjectMilestone } from "@/lib/types/database";
import { formatDate } from "@/lib/format";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export function ProjectFilesPanel({
  projectId,
  files,
  compact = false,
}: {
  projectId: string;
  files: ProjectFile[];
  compact?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
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

  async function downloadFile(file: ProjectFile) {
    const result = await getProjectFileSignedUrl(file.storage_path);
    if (!result.ok || !result.url) {
      toast.error(result.ok ? "Download link unavailable" : result.error);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function removeFile(file: ProjectFile) {
    const ok = await confirm({
      title: `Delete ${file.file_name}?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete file",
      variant: "destructive",
    });
    if (!ok) return;
    const result = await deleteProjectFile(file.id, projectId);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("File deleted");
      router.refresh();
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {!compact ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Files</p>
          <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onFilesSelected(e.target.files)}
        />
        </div>
      ) : (
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onFilesSelected(e.target.files)}
        />
      )}
      <button
        type="button"
        className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-muted-foreground transition-colors ${
          compact ? "min-h-14 px-2 py-2 text-[11px]" : "min-h-24 rounded-lg px-3 py-4 text-sm"
        } ${
          dragging ? "border-primary bg-muted/60" : "border-border hover:bg-muted/40"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFilesSelected(e.dataTransfer.files);
        }}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {files.length === 0
          ? "Drop files or click to upload"
          : "Add more files"}
      </button>
      {files.length > 0 ? (
        <ul className="space-y-1">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
            >
              <span className="min-w-0 truncate font-medium">
                {file.file_name}
              </span>
              <span className="flex gap-0.5">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => void downloadFile(file)}
                  aria-label={`Download ${file.file_name}`}
                >
                  <Download className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => void removeFile(file)}
                  aria-label={`Delete ${file.file_name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ProjectMilestonesPanel({
  projectId,
  milestones,
  compact = false,
}: {
  projectId: string;
  milestones: ProjectMilestone[];
  compact?: boolean;
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

  async function onDelete(milestone: ProjectMilestone) {
    const result = await deleteProjectMilestone(milestone.id, projectId);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Milestone deleted");
      router.refresh();
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {!compact ? <p className="text-sm font-medium">Milestones</p> : null}
      <form
        onSubmit={onAdd}
        className={compact ? "flex flex-col gap-1.5" : "flex gap-2"}
      >
        <Input
          name="title"
          placeholder="Milestone title"
          required
          className={compact ? "h-8 text-xs" : undefined}
        />
        <div className={compact ? "flex gap-1.5" : "contents"}>
          <Input
            name="due_date"
            type="date"
            className={compact ? "h-8 flex-1 text-xs" : "w-40"}
          />
          <Button
            type="submit"
            size="sm"
            disabled={pending}
            className={compact ? "h-8 shrink-0" : undefined}
          >
            Add
          </Button>
        </div>
      </form>
      {milestones.length ? (
        <ul className={compact ? "space-y-1" : "space-y-2"}>
          {milestones.map((milestone) => (
            <li
              key={milestone.id}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
            >
              <Checkbox
                checked={Boolean(milestone.completed_at)}
                onCheckedChange={(value) =>
                  void onToggle(milestone, value === true)
                }
              />
              <span
                className={cn(
                  "flex-1",
                  milestone.completed_at && "text-muted-foreground line-through"
                )}
              >
                {milestone.title}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatDate(milestone.due_date)}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => void onDelete(milestone)}
                aria-label={`Delete ${milestone.title}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No milestones yet.</p>
      )}
    </div>
  );
}
