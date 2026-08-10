"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { createInvoice, updateInvoice } from "@/lib/data/invoices";
import type {
  Customer,
  Invoice,
  InvoiceLineItem,
  Project,
} from "@/lib/types/database";
import {
  addCalendarDays,
  formatCurrency,
  toCalendarDateString,
} from "@/lib/format";
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
  serviceDate: string;
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
    serviceDate: partial?.serviceDate ?? "",
    description: partial?.description ?? "",
    quantity: partial?.quantity ?? "1",
    rate: partial?.rate ?? "",
  };
}

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!s || s === "." || s === "-" || s === "-.") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyField(raw: string): string {
  const trimmed = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!trimmed || trimmed === "." || trimmed === "-" || trimmed === "-.") {
    return "";
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return raw;
  return n.toFixed(2);
}

function formatInitialNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  return (Math.round(value * 100) / 100).toFixed(2);
}

/**
 * Select the full value when the field is focused (tab or click).
 * Click-to-focus clears selection on mouseup, so we re-select on click too.
 */
function selectAllOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.select();
}

function selectAllOnClick(e: React.MouseEvent<HTMLInputElement>) {
  e.currentTarget.select();
}

function MoneyInput({
  value,
  onChange,
  onKeyDown,
  placeholder = "0.00",
  "aria-label": ariaLabel,
  "data-line-field": dataLineField,
  className,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  "aria-label"?: string;
  "data-line-field"?: string;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
        aria-hidden
      >
        $
      </span>
      <Input
        id={id}
        data-line-field={dataLineField}
        inputMode="decimal"
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pl-6 text-right tabular-nums"
        value={value}
        onFocus={selectAllOnFocus}
        onClick={selectAllOnClick}
        onBlur={(e) => onChange(formatMoneyField(e.target.value))}
        onChange={(e) => {
          const next = e.target.value.replace(/^\$/, "").replace(/,/g, "");
          if (next === "" || /^\d*\.?\d*$/.test(next)) {
            onChange(next);
          }
        }}
        onKeyDown={onKeyDown}
      />
    </div>
  );
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
  onSuccess?: (invoiceId: string, mode: "default" | "close") => void;
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
            serviceDate: line.service_date ?? "",
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
  const formRef = React.useRef<HTMLFormElement>(null);
  const descInputRefs = React.useRef<Map<string, HTMLInputElement | null>>(
    new Map()
  );
  const dragKeyRef = React.useRef<string | null>(null);
  const [dragOverKey, setDragOverKey] = React.useState<string | null>(null);

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

  function moveLineBy(key: string, delta: number) {
    setLines((prev) => {
      const from = prev.findIndex((item) => item.key === key);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function moveLineTo(fromKey: string, toKey: string) {
    if (fromKey === toKey) return;
    setLines((prev) => {
      const from = prev.findIndex((item) => item.key === fromKey);
      const to = prev.findIndex((item) => item.key === toKey);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function onLineFieldKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    field: "description" | "quantity" | "rate",
    _lineKey: string
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

  async function saveInvoice(mode: "default" | "close") {
    const form = formRef.current;
    if (!form) return;

    // Save and close = draft shell OK. Create / Save = fully ready invoice.
    const allowIncomplete = mode === "close";

    const prepared = lines
      .filter((line) => line.description.trim())
      .map((line) => {
        const quantity = parseAmount(line.quantity);
        const rate = parseAmount(line.rate);
        // Empty date inputs yield ""; Postgres rejects "" for date columns.
        const serviceDate = line.serviceDate.trim();
        return {
          description: line.description.trim(),
          quantity,
          rate,
          service_date: serviceDate.length > 0 ? serviceDate : null,
        };
      });

    if (!allowIncomplete) {
      if (!customerId) {
        toast.error("Select or add a customer first");
        return;
      }
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
    } else {
      for (const line of prepared) {
        if (line.quantity < 0) {
          toast.error("Quantity cannot be negative");
          return;
        }
        if (line.rate < 0) {
          toast.error("Rate cannot be negative");
          return;
        }
      }
    }

    if (taxAmount < 0) {
      toast.error("Tax cannot be negative");
      return;
    }

    const formData = new FormData(form);
    const issueDate = String(formData.get("issue_date") ?? "").trim();
    const dueDate = String(formData.get("due_date") ?? "").trim();
    if (!allowIncomplete && (!issueDate || !dueDate)) {
      toast.error("Issue date and due date are required");
      return;
    }

    setPending(true);
    const payload = {
      customer_id: customerId || null,
      project_id: projectId || null,
      issue_date: issueDate || null,
      due_date: dueDate || null,
      notes: String(formData.get("notes") || "") || null,
      tax: taxAmount,
      lines: prepared,
      allowIncomplete,
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

    toast.success(
      allowIncomplete
        ? editing
          ? "Draft saved"
          : "Draft saved for later"
        : editing
          ? "Invoice updated"
          : "Invoice created"
    );
    if (onSuccess && result.id) {
      onSuccess(result.id, mode);
      return;
    }

    if (mode === "close") {
      router.push("/finance/invoices");
      router.refresh();
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
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        void saveInvoice("default");
      }}
      className={className ?? "mx-auto max-w-4xl space-y-4"}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Customer</Label>
          <CustomerPicker
            value={customerId}
            onValueChange={onCustomerChange}
            customers={customers}
            onCustomersChange={(next) => setCustomers(next as Customer[])}
            allowNone
            placeholder="Customer (optional for draft)"
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
            defaultValue={
              invoice?.issue_date ?? toCalendarDateString()
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due_date">Due date</Label>
          <Input
            id="due_date"
            name="due_date"
            type="date"
            defaultValue={
              invoice?.due_date ?? addCalendarDays(toCalendarDateString(), 30)
            }
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>Line items</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7"
            onClick={addLineAndFocus}
          >
            <Plus className="size-3.5" />
            Add line
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Drag the handle or use arrows to reorder. Optional date — leave blank
          to hide it. Enter in price adds a new line.
        </p>

        <div className="overflow-x-auto rounded-lg border border-border">
          <div className="hidden min-w-[720px] grid-cols-[1.75rem_7.5rem_minmax(0,1fr)_4.5rem_6.5rem_5.5rem_1.75rem_1.75rem] gap-1.5 border-b border-border bg-muted/30 px-2 py-1.5 text-[11px] font-medium text-muted-foreground sm:grid">
            <span className="sr-only">Reorder</span>
            <span>Date</span>
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Amount</span>
            <span className="sr-only">Move</span>
            <span className="sr-only">Remove</span>
          </div>

          <div className="min-w-[720px] divide-y divide-border">
            {lines.map((line, index) => {
              const lineTotal =
                parseAmount(line.quantity) * parseAmount(line.rate);
              const isDragOver = dragOverKey === line.key;
              return (
                <div
                  key={line.key}
                  data-line-row
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverKey !== line.key) setDragOverKey(line.key);
                  }}
                  onDragLeave={(e) => {
                    // Only clear when leaving the row, not entering a child
                    if (
                      e.currentTarget.contains(e.relatedTarget as Node | null)
                    ) {
                      return;
                    }
                    setDragOverKey((cur) => (cur === line.key ? null : cur));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromKey =
                      e.dataTransfer.getData("text/plain") ||
                      dragKeyRef.current;
                    if (fromKey) moveLineTo(fromKey, line.key);
                    dragKeyRef.current = null;
                    setDragOverKey(null);
                  }}
                  className={cn(
                    "grid grid-cols-[1.75rem_7.5rem_minmax(0,1fr)_4.5rem_6.5rem_5.5rem_1.75rem_1.75rem] items-center gap-1.5 px-2 py-1 transition-colors",
                    isDragOver && "bg-muted/50 ring-1 ring-inset ring-ring/40"
                  )}
                >
                  <button
                    type="button"
                    draggable
                    aria-label={`Drag to reorder line ${index + 1}`}
                    title="Drag to reorder"
                    className="inline-flex size-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                    onDragStart={(e) => {
                      dragKeyRef.current = line.key;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", line.key);
                      // Improve drag image for some browsers
                      if (e.currentTarget.parentElement) {
                        e.dataTransfer.setDragImage(
                          e.currentTarget.parentElement,
                          16,
                          16
                        );
                      }
                    }}
                    onDragEnd={() => {
                      dragKeyRef.current = null;
                      setDragOverKey(null);
                    }}
                  >
                    <GripVertical className="size-3.5" />
                  </button>
                  <Input
                    type="date"
                    className="h-8 px-1.5 text-xs"
                    aria-label={`Date line ${index + 1}`}
                    value={line.serviceDate}
                    onChange={(e) =>
                      updateLine(line.key, { serviceDate: e.target.value })
                    }
                  />
                  <Input
                    ref={(el) => {
                      descInputRefs.current.set(line.key, el);
                    }}
                    className="h-8"
                    placeholder="Description"
                    value={line.description}
                    onFocus={selectAllOnFocus}
                    onChange={(e) =>
                      updateLine(line.key, { description: e.target.value })
                    }
                    onKeyDown={(e) =>
                      onLineFieldKeyDown(e, "description", line.key)
                    }
                  />
                  <Input
                    data-line-field="quantity"
                    className="h-8 text-right tabular-nums"
                    inputMode="decimal"
                    placeholder="Qty"
                    aria-label={`Quantity line ${index + 1}`}
                    value={line.quantity}
                    onFocus={selectAllOnFocus}
                    onClick={selectAllOnClick}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === "" || /^\d*\.?\d*$/.test(next)) {
                        updateLine(line.key, { quantity: next });
                      }
                    }}
                    onBlur={() => {
                      if (line.quantity.trim() === "") return;
                      const n = parseAmount(line.quantity);
                      updateLine(line.key, {
                        quantity: Number.isInteger(n)
                          ? String(n)
                          : n.toFixed(2),
                      });
                    }}
                    onKeyDown={(e) =>
                      onLineFieldKeyDown(e, "quantity", line.key)
                    }
                  />
                  <MoneyInput
                    data-line-field="rate"
                    aria-label={`Rate line ${index + 1}`}
                    value={line.rate}
                    onChange={(next) => updateLine(line.key, { rate: next })}
                    onKeyDown={(e) => onLineFieldKeyDown(e, "rate", line.key)}
                  />
                  <div
                    className={cn(
                      "pr-0.5 text-right text-xs tabular-nums text-muted-foreground",
                      lineTotal > 0 && "text-foreground"
                    )}
                    aria-label={`Amount line ${index + 1}`}
                  >
                    {formatCurrency(lineTotal)}
                  </div>
                  <div className="flex flex-col items-center gap-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-6 shrink-0"
                      disabled={index === 0}
                      aria-label={`Move line ${index + 1} up`}
                      title="Move up"
                      onClick={() => moveLineBy(line.key, -1)}
                    >
                      <ChevronUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-6 shrink-0"
                      disabled={index === lines.length - 1}
                      aria-label={`Move line ${index + 1} down`}
                      title="Move down"
                      onClick={() => moveLineBy(line.key, 1)}
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0"
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() => removeLine(line.key)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
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
            <MoneyInput
              id="tax"
              className="w-32"
              value={tax}
              onChange={setTax}
            />
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-sm font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => void saveInvoice("close")}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save and close
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {editing ? "Save invoice" : "Create invoice"}
        </Button>
      </div>
    </form>
  );
}
