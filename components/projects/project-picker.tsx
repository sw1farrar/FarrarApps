"use client";

import * as React from "react";
import type { Project } from "@/lib/types/database";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { Button } from "@/components/ui/button";

export function ProjectPicker({
  name = "project_id",
  value,
  onValueChange,
  projects,
  customerId,
  allowNone = true,
  placeholder = "Select project",
  onCreateHref,
}: {
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  projects: Pick<Project, "id" | "name" | "customer_id">[];
  customerId?: string;
  allowNone?: boolean;
  placeholder?: string;
  onCreateHref?: string | null;
}) {
  const filtered = projects.filter(
    (project) => !customerId || project.customer_id === customerId
  );
  const options = filtered.map((project) => ({
    id: project.id,
    label: project.name,
  }));

  return (
    <div className="space-y-1.5">
      <EntityCombobox
        name={name}
        value={value}
        onValueChange={onValueChange}
        options={options}
        allowNone={allowNone}
        noneLabel="None"
        placeholder={
          customerId && filtered.length === 0
            ? "No projects for this customer"
            : placeholder
        }
        searchPlaceholder="Search projects…"
        emptyLabel="No projects match"
        onCreate={
          onCreateHref
            ? () => {
                window.location.href = onCreateHref;
              }
            : undefined
        }
        createLabel="Create project"
      />
      {customerId && filtered.length === 0 && onCreateHref ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => {
            window.location.href = onCreateHref;
          }}
        >
          Create a project for this customer
        </Button>
      ) : null}
    </div>
  );
}
