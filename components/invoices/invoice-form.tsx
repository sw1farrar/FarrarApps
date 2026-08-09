"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { createInvoice, updateInvoice } from "@/lib/data/invoices";
import type {
  Customer,
  Invoice,
  InvoiceLineItem,
  Project,
} from "@/lib/types/database";
import { formatCurrency } from "@/lib/format";
import { CustomerPicker } from "@/components/customers/customer-picker";
import { ProjectPicker } from "@/components/projects/project-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Keep raw strings so users can clear fields and type decimals freely. */
type LineDraft = {
  key: string;
  description: string;
  quantity: string;
  rate: string;
};

function newLine(partial?: Partial<Omit<LineDraft, "key">>): LineDraft {
  return {
    key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: partial?.description ?? "",
    quantity: partial?.quantity ?? "1",
    rate: partial?.rate ?? "",
  };
}

function parseAmount(raw: string): number {
  const s = raw.trim();
  if (!s || s === "." || s === "-" || s === "-.") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatInitialNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  // Avoid "1.5000000001"; keep meaningful decimals
  const rounded = Math.round(value * 1e6) / 1e6;
  return String(rounded);
}

function selectAllOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  // Defer so click-to-focus still selects rather than placing caret
  requestAnimationFrame(() => {
    e.target.select();
  });
}

export function InvoiceForm({
  customers: initialCustomers,
  projects: initialProjects,
  defaultCustomerId,
  defaultProjectId,
  invoice,
  lines: initialLines,
  onSuccess,
  className,
}: {
  customers: Customer[];
  projects: Project[];
  defaultCustomerId?: string;
  defaultProjectId?: string;
  invoice?: Invoice;
  lines?: InvoiceLineItem[];
  /** If set, called after create/update instead of navigating to the invoice page. */
  onSuccess?: (invoiceId: string) => void;
  className?: string;
}) {
  const router = useRouter();
  const editing = Boolean(invoice);
  const [pending, setPending] = React.useState(false);
  const [customers, setCustomers] = React.useState(initialCustomers);
  const [projects] = React.useState(initialProjects);
  const [customerId, setCustomerId] = React.useState(
    invoice?.customer_id ?? defaultCustomerId ?? ""
  );
  const [projectId, setProjectId] = React.useState(
    invoice?.project_id ?? defaultProjectId ?? ""
  );
  const [lines, setLines] = React.useState<LineDraft[]>([
    ...(initialLines?.length
      ? initialLines.map((line) =>
          newLine({
            description: line.description,
            quantity: formatInitialNumber(Number(line.quantity)),
            rate: formatInitialNumber(Number(line.rate)),
          })
        )
      : [newLine()]),
  ]);
  const [tax, setTax] = React.useState(
    invoice?.tax != null && Number(invoice.tax) !== 0
      ? formatInitialNumber(Number(invoice.tax))
      : ""
  );
  const descInputRefs = React.useRef<Map<string, HTMLInputElement | null>>(
    new Map()
  );

  React.useEffect(() => {
    setCustomers(initialCustomers);
  }, [initialCustomers]);

  const subtotal = lines.reduce(
    (sum, line) => sum + parseAmount(line.quantity) * parseAmount(line.rate),
    0
  );
  const taxAmount = parseAmount(tax);
  const total = subtotal + taxAmount;

  function onCustomerChange(nextId: string) {
    setCustomerId(nextId);
    const stillValid = projects.some(
      (project) =>
        project.id === projectId && project.customer_id === nextId
    );
    if (!stillValid) setProjectId("");
  }

  function updateLine(key: string, patch: Partial<Omit<LineDraft, "key">>) {
    setLines((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  function addLineAndFocus() {
    const line = newLine();
    setLines((prev) => [...prev, line]);
    requestAnimationFrame(() => {
      const el = descInputRefs.current.get(line.key);
      el?.focus();
      el?.select();
    });
  }

  function removeLine(key: string) {
    setLines((prev) => {
      if (prev.length <= 1) {
        // Keep one empty editable row instead of a dead-end empty form
        return [newLine()];
      }
      return prev.filter((item) => item.key !== key);
    });
  }

  function onLineFieldKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    field: "description" | "quantity" | "rate",
    lineKey: string
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    // Don't submit the whole invoice form
    e.stopPropagation();

    if (field === "description") {
      const qty = e.currentTarget
        .closest("[data-line-row]")
        ?.querySelector<HTMLInputElement>('[data-line-field="quantity"]');
      qty?.focus();
      qty?.select();
      return;
    }
    if (field === "quantity") {
      const rate = e.currentTarget
        .closest("[data-line-row]")
        ?.querySelector<HTMLInputElement>('[data-line-field="rate"]');
      rate?.focus();
      rate?.select();
      return;
    }
    // Rate / price: add next line (user request)
    addLineAndFocus();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customerId) {
      toast.error("Select or add a customer first");
      return;
    }

    const prepared = lines
      .filter((line) => line.description.trim())
      .map((line) => {
        const quantity = parseAmount(line.quantity);
        const rate = parseAmount(line.rate);
        return {
          description: line.description.trim(),
          quantity,
          rate,
        };
      });

    if (!prepared.length) {
      toast.error("Add at least one line item with a description");
      return;
    }

    for (const line of prepared) {
      if (line.quantity < 0) {
        toast.error("Quantity cannot be negative");
        return;
      }
      if (line.rate < 0) {
        toast.error("Rate cannot be negative");
        return;
      }
      if (line.quantity === 0 && line.rate === 0) {
        toast.error("Each line needs a quantity or rate");
        return;
      }
    }

    if (taxAmount < 0) {
      toast.error("Tax cannot be negative");
      return;
    }

    setPending(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      customer_id: customerId,
      project_id: projectId || null,
      issue_date: String(formData.get("issue_date")),
      due_date: String(formData.get("due_date")),
      notes: String(formData.get("notes") || "") || null,
      tax: taxAmount,
      lines: prepared,
    };
    const result =
      editing && invoice
        ? await updateInvoice(invoice.id, payload)
        : await createInvoice(payload);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(editing ? "Invoice updated" : "Invoice created");
    if (onSuccess && result.id) {
      onSuccess(result.id);
      return;
    }
    // New invoices open the email dialog so the customer gets the PDF + pay link
    router.push(
      editing
        ? `/finance/invoices/${result.id}`
        : `/finance/invoices/${result.id}?email=1`
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={className ?? "mx-auto max-w-3xl space-y-4"}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Customer</Label>
          <CustomerPicker
            value={customerId}
            onValueChange={onCustomerChange}
            customers={customers}
            onCustomersChange={(next) => setCustomers(next as Customer[])}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Project</Label>
          <ProjectPicker
            value={projectId}
            onValueChange={setProjectId}
            projects={projects}
            customerId={customerId || undefined}
            onCreateHref={
              customerId
                ? `/projects/new?customerId=${customerId}`
                : null
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="issue_date">Issue date</Label>
          <Input
            id="issue_date"
            name="issue_date"
            type="date"
            required
            defaultValue={
              invoice?.issue_date ?? new Date().toISOString().slice(0, 10)
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due_date">Due date</Label>
          <Input
            id="due_date"
            name="due_date"
            type="date"
            required
            defaultValue={
              invoice?.due_date ??
              new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Line items</Label>
          <Button type="button" size="sm" variant="outline" onClick={addLineAndFocus}>
            <Plus className="size-4" />
            Add line
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Enter in price moves to a new line. Each line can be edited or deleted.
        </p>
        <div className="hidden text-[11px] text-muted-foreground sm:grid sm:grid-cols-[1fr_90px_110px_40px] sm:gap-2">
          <span>Description</span>
          <span>Qty</span>
          <span>Rate</span>
          <span />
        </div>
        {lines.map((line, index) => {
          const lineTotal =
            parseAmount(line.quantity) * parseAmount(line.rate);
          return (
            <div key={line.key} className="space-y-1" data-line-row>
              <div className="grid gap-2 sm:grid-cols-[1fr_90px_110px_40px]">
                <Input
                  ref={(el) => {
                    descInputRefs.current.set(line.key, el);
                  }}
                  placeholder="Description"
                  value={line.description}
                  onFocus={selectAllOnFocus}
                  onChange={(e) =>
                    updateLine(line.key, { description: e.target.value })
                  }
                  onKeyDown={(e) =>
                    onLineFieldKeyDown(e, "description", line.key)
                  }
                  required
                />
                <Input
                  data-line-field="quantity"
                  inputMode="decimal"
                  placeholder="Qty"
                  aria-label={`Quantity line ${index + 1}`}
                  value={line.quantity}
                  onFocus={selectAllOnFocus}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === "" || /^\d*\.?\d*$/.test(next)) {
                      updateLine(line.key, { quantity: next });
                    }
                  }}
                  onKeyDown={(e) =>
                    onLineFieldKeyDown(e, "quantity", line.key)
                  }
                />
                <Input
                  data-line-field="rate"
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={`Rate line ${index + 1}`}
                  value={line.rate}
                  onFocus={selectAllOnFocus}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === "" || /^\d*\.?\d*$/.test(next)) {
                      updateLine(line.key, { rate: next });
                    }
                  }}
                  onKeyDown={(e) => onLineFieldKeyDown(e, "rate", line.key)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove line ${index + 1}`}
                  onClick={() => removeLine(line.key)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <p
                className={cn(
                  "text-right text-[11px] tabular-nums text-muted-foreground sm:pr-12",
                  lineTotal > 0 && "text-foreground/80"
                )}
              >
                Line total {formatCurrency(lineTotal)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes / terms</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={invoice?.notes ?? ""}
          />
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
              inputMode="decimal"
              placeholder="0.00"
              className="w-28"
              value={tax}
              onFocus={selectAllOnFocus}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "" || /^\d*\.?\d*$/.test(next)) {
                  setTax(next);
                }
              }}
            />
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-sm font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {editing ? "Save invoice" : "Create invoice"}
      </Button>
    </form>
  );
}
