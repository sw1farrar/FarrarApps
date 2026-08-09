"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createProject, updateProject } from "@/lib/data/projects";
import type { Customer, Project, ProjectStatus } from "@/lib/types/database";
import { titleCase } from "@/lib/format";
import { CustomerPicker } from "@/components/customers/customer-picker";
import { FormSelect } from "@/components/ui/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const statusOptions = (
  [
    "planning",
    "in_progress",
    "delivered",
    "archived",
  ] as ProjectStatus[]
).map((status) => ({
  value: status,
  label: titleCase(status),
}));

export function ProjectForm({
  customers: initialCustomers,
  project,
  defaultCustomerId,
  compact = false,
}: {
  customers: Customer[];
  project?: Project;
  defaultCustomerId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [customers, setCustomers] = React.useState(initialCustomers);
  const [customerId, setCustomerId] = React.useState(
    project?.customer_id ?? defaultCustomerId ?? ""
  );
  const [status, setStatus] = React.useState<ProjectStatus>(
    project?.status ?? "planning"
  );

  React.useEffect(() => {
    setCustomers(initialCustomers);
  }, [initialCustomers]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customerId) {
      toast.error("Select or add a customer first");
      return;
    }
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("customer_id", customerId);
    formData.set("status", status);
    // Compact sidebar edits keep the existing name when field is omitted
    if (compact && project?.name && !formData.get("name")) {
      formData.set("name", project.name);
    }
    const result = project
      ? await updateProject(project.id, formData)
      : await createProject(formData);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(project ? "Project updated" : "Project created");
    if (project) {
      router.refresh();
    } else {
      router.push(`/projects/${result.id}`);
    }
  }

  if (compact && project) {
    // Customer/name live in the project page header — sidebar only edits status + scope
    return (
      <form onSubmit={onSubmit} className="space-y-2.5">
        <input type="hidden" name="customer_id" value={customerId} />
        <div className="space-y-1">
          <Label htmlFor="status" className="text-[11px] text-muted-foreground">
            Status
          </Label>
          <FormSelect
            id="status"
            name="status"
            value={status}
            onValueChange={(value) => setStatus(value as ProjectStatus)}
            options={statusOptions}
            placeholder="Select status"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="scope" className="text-[11px] text-muted-foreground">
            Scope
          </Label>
          <Textarea
            id="scope"
            name="scope"
            rows={4}
            placeholder="Scope of work (markdown ok)"
            defaultValue={project.scope ?? ""}
            className="text-xs"
          />
        </div>
        <Button type="submit" size="sm" className="w-full" disabled={pending}>
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Save changes
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-2xl space-y-3"
    >
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
          <Label>Customer</Label>
          <CustomerPicker
            value={customerId}
            onValueChange={setCustomerId}
            customers={customers}
            onCustomersChange={(next) => setCustomers(next as Customer[])}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <FormSelect
            id="status"
            name="status"
            value={status}
            onValueChange={(value) => setStatus(value as ProjectStatus)}
            options={statusOptions}
            placeholder="Select status"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scope">Scope of work</Label>
        <Textarea
          id="scope"
          name="scope"
          rows={8}
          placeholder="Scope of work (markdown supported)"
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
