"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { createInvoice } from "@/lib/data/invoices";
import type { Customer, Project } from "@/lib/types/database";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Line = { description: string; quantity: number; rate: number };

export function InvoiceForm({
  customers,
  projects,
  defaultCustomerId,
  defaultProjectId,
}: {
  customers: Customer[];
  projects: Project[];
  defaultCustomerId?: string;
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [customerId, setCustomerId] = React.useState(defaultCustomerId ?? "");
  const [lines, setLines] = React.useState<Line[]>([
    { description: "", quantity: 1, rate: 0 },
  ]);
  const [tax, setTax] = React.useState(0);

  const filteredProjects = projects.filter(
    (project) => !customerId || project.customer_id === customerId
  );

  const subtotal = lines.reduce(
    (sum, line) => sum + line.quantity * line.rate,
    0
  );
  const total = subtotal + tax;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setPending(true);
    const result = await createInvoice({
      customer_id: String(formData.get("customer_id") || ""),
      project_id: String(formData.get("project_id") || "") || null,
      issue_date: String(formData.get("issue_date")),
      due_date: String(formData.get("due_date")),
      notes: String(formData.get("notes") || "") || null,
      tax,
      lines: lines.filter((line) => line.description.trim()),
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Invoice created");
    router.push(`/invoices/${result.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="customer_id">Customer</Label>
          <select
            id="customer_id"
            name="customer_id"
            required
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
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
          <Label htmlFor="project_id">Project</Label>
          <select
            id="project_id"
            name="project_id"
            defaultValue={defaultProjectId ?? ""}
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
          >
            <option value="">None</option>
            {filteredProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="issue_date">Issue date</Label>
          <Input
            id="issue_date"
            name="issue_date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due_date">Due date</Label>
          <Input
            id="due_date"
            name="due_date"
            type="date"
            required
            defaultValue={new Date(Date.now() + 30 * 86400000)
              .toISOString()
              .slice(0, 10)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Line items</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { description: "", quantity: 1, rate: 0 },
              ])
            }
          >
            <Plus className="size-4" />
            Add line
          </Button>
        </div>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_90px_110px_40px]">
            <Input
              placeholder="Description"
              value={line.description}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, description: e.target.value } : item
                  )
                )
              }
              required
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={line.quantity}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((item, i) =>
                    i === index
                      ? { ...item, quantity: Number(e.target.value) }
                      : item
                  )
                )
              }
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={line.rate}
              onChange={(e) =>
                setLines((prev) =>
                  prev.map((item, i) =>
                    i === index
                      ? { ...item, rate: Number(e.target.value) }
                      : item
                  )
                )
              }
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={lines.length === 1}
              onClick={() =>
                setLines((prev) => prev.filter((_, i) => i !== index))
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes / terms</Label>
          <Textarea id="notes" name="notes" rows={4} />
        </div>
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <Label htmlFor="tax">Tax</Label>
            <Input
              id="tax"
              type="number"
              min="0"
              step="0.01"
              className="w-28"
              value={tax}
              onChange={(e) => setTax(Number(e.target.value))}
            />
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-sm font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Create invoice
      </Button>
    </form>
  );
}
