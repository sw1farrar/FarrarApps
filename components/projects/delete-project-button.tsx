"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteProject } from "@/lib/data/projects";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const confirm = useConfirm();

  async function onDelete() {
    const ok = await confirm({
      title: "Delete this project?",
      description:
        "This cannot be undone. Linked records may block deletion.",
      confirmLabel: "Delete project",
      variant: "destructive",
    });
    if (!ok) return;
    const result = await deleteProject(projectId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Project deleted");
    router.push("/projects");
    router.refresh();
  }

  return (
    <Button variant="destructive" size="sm" onClick={() => void onDelete()}>
      Delete
    </Button>
  );
}
