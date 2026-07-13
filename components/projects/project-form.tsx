"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createProject, updateProject } from "@/lib/data/projects";
import type { Customer, Project, ProjectStatus } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const statuses: ProjectStatus[] = [
  "planning",
  "in_progress",
  "delivered",
  "archived",
];

export function ProjectForm({
  customers,
  project,
  defaultCustomerId,
}: {
  customers: Customer[];
  project?: Project;
  defaultCustomerId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = project
      ? await updateProject(project.id, formData)
      : await createProject(formData);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(project ? "Project updated" : "Project created");
    router.push(`/projects/${result.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">Project name</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={project?.name ?? ""}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="customer_id">Customer</Label>
          <select
            id="customer_id"
            name="customer_id"
            required
            defaultValue={project?.customer_id ?? defaultCustomerId ?? ""}
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
          >
            <option value="" disabled>
              Select customer
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={project?.status ?? "planning"}
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scope">Scope of work</Label>
        <Textarea
          id="scope"
          name="scope"
          rows={8}
          placeholder="Markdown supported"
          defaultValue={project?.scope ?? ""}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {project ? "Save project" : "Create project"}
      </Button>
    </form>
  );
}
