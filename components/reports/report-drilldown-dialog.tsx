"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ReportTxRow } from "@/lib/data/reports";
import type { ArInvoiceRow } from "@/lib/data/balances";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type TxDrilldownSpec = {
  kind: "tx";
  title: string;
  description?: string;
  rows: ReportTxRow[];
  /** How to sum the footer total */
  sumMode?: "gross" | "signed";
};

export type ArDrilldownSpec = {
  kind: "ar";
  title: string;
  description?: string;
  rows: ArInvoiceRow[];
};

export type DrilldownSpec = TxDrilldownSpec | ArDrilldownSpec;

export function ReportDrilldownDialog({
  open,
  onOpenChange,
  spec,
  onOpenInvoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spec: DrilldownSpec | null;
  onOpenInvoice: (invoiceId: string) => void;
}) {
  if (!spec) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg" />
      </Dialog>
    );
  }

  const total =
    spec.kind === "tx"
      ? spec.sumMode === "signed"
        ? spec.rows.reduce(
            (s, r) => s + (r.type === "expense" ? -r.amount : r.amount),
            0
          )
        : spec.rows.reduce((s, r) => s + r.amount, 0)
      : spec.rows.reduce((s, r) => s + r.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,90vh)] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-base">{spec.title}</DialogTitle>
              {spec.description ? (
                <DialogDescription className="text-xs">
                  {spec.description}
                </DialogDescription>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">
                {spec.rows.length} item{spec.rows.length === 1 ? "" : "s"}
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {formatCurrency(total)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          {spec.kind === "tx" ? (
            <TxTable rows={spec.rows} onOpenInvoice={onOpenInvoice} />
          ) : (
            <ArTable rows={spec.rows} onOpenInvoice={onOpenInvoice} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EntityLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "font-medium text-foreground underline-offset-2 hover:underline",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}

function InvoiceButton({
  id,
  label,
  onOpen,
}: {
  id: string;
  label: string;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(id);
      }}
      className="font-medium text-primary underline-offset-2 hover:underline"
    >
      {label}
    </button>
  );
}

function TxTable({
  rows,
  onOpenInvoice,
}: {
  rows: ReportTxRow[];
  onOpenInvoice: (id: string) => void;
}) {
  if (!rows.length) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        No line items for this total.
      </p>
    );
  }

  return (
    <table className="w-full min-w-[720px] text-sm">
      <thead className="sticky top-0 z-[1] bg-popover">
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="px-3 py-2 font-medium">Date</th>
          <th className="px-3 py-2 font-medium">Type</th>
          <th className="px-3 py-2 font-medium">Description</th>
          <th className="px-3 py-2 font-medium">Customer</th>
          <th className="px-3 py-2 font-medium">Project</th>
          <th className="px-3 py-2 font-medium">Invoice</th>
          <th className="px-3 py-2 font-medium">Account</th>
          <th className="px-3 py-2 font-medium">Category</th>
          <th className="px-3 py-2 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className="border-b border-border last:border-0 hover:bg-muted/30"
          >
            <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
              {formatDate(row.date)}
            </td>
            <td className="px-3 py-2 capitalize">
              {row.type === "income"
                ? "Income"
                : row.type === "expense"
                  ? "Expense"
                  : "Transfer"}
            </td>
            <td className="max-w-[200px] truncate px-3 py-2">
              {row.description || "—"}
            </td>
            <td className="px-3 py-2">
              {row.customerId ? (
                <EntityLink href={`/customers/${row.customerId}`}>
                  {row.customer}
                </EntityLink>
              ) : (
                <span className="text-muted-foreground">
                  {row.customer || "—"}
                </span>
              )}
            </td>
            <td className="px-3 py-2">
              {row.projectId ? (
                <EntityLink href={`/projects/${row.projectId}`}>
                  {row.project}
                </EntityLink>
              ) : (
                <span className="text-muted-foreground">
                  {row.project || "—"}
                </span>
              )}
            </td>
            <td className="px-3 py-2">
              {row.invoiceId && row.invoiceNumber ? (
                <span className="inline-flex items-center gap-1">
                  <InvoiceButton
                    id={row.invoiceId}
                    label={row.invoiceNumber}
                    onOpen={onOpenInvoice}
                  />
                  <Link
                    href={`/finance/invoices/${row.invoiceId}`}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon-sm" }),
                      "size-6"
                    )}
                    title="Open invoice page"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="size-3" />
                  </Link>
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
            <td className="px-3 py-2 text-muted-foreground">
              {row.type === "transfer" && row.transferAccount ? (
                <>
                  {row.accountId ? (
                    <EntityLink href={`/finance/accounts/${row.accountId}`}>
                      {row.account}
                    </EntityLink>
                  ) : (
                    row.account
                  )}
                  <span className="mx-1">→</span>
                  {row.transferAccountId ? (
                    <EntityLink
                      href={`/finance/accounts/${row.transferAccountId}`}
                    >
                      {row.transferAccount}
                    </EntityLink>
                  ) : (
                    row.transferAccount
                  )}
                </>
              ) : row.accountId ? (
                <EntityLink href={`/finance/accounts/${row.accountId}`}>
                  {row.account || "—"}
                </EntityLink>
              ) : (
                row.account || "—"
              )}
            </td>
            <td className="px-3 py-2 text-muted-foreground">
              {row.category || "—"}
            </td>
            <td
              className={cn(
                "px-3 py-2 text-right tabular-nums font-medium",
                row.type === "expense" && "text-muted-foreground"
              )}
            >
              {row.type === "expense" ? "−" : ""}
              {formatCurrency(row.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ArTable({
  rows,
  onOpenInvoice,
}: {
  rows: ArInvoiceRow[];
  onOpenInvoice: (id: string) => void;
}) {
  if (!rows.length) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        No open invoices for this total.
      </p>
    );
  }

  const bucketLabel: Record<ArInvoiceRow["agingBucket"], string> = {
    current: "Current",
    days30: "1–30",
    days60: "31–60",
    days90: "61+",
  };

  return (
    <table className="w-full min-w-[700px] text-sm">
      <thead className="sticky top-0 z-[1] bg-popover">
        <tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="px-3 py-2 font-medium">Invoice</th>
          <th className="px-3 py-2 font-medium">Customer</th>
          <th className="px-3 py-2 font-medium">Project</th>
          <th className="px-3 py-2 font-medium">Due</th>
          <th className="px-3 py-2 font-medium">Aging</th>
          <th className="px-3 py-2 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className="border-b border-border last:border-0 hover:bg-muted/30"
          >
            <td className="px-3 py-2">
              <span className="inline-flex items-center gap-1">
                <InvoiceButton
                  id={row.id}
                  label={row.invoiceNumber}
                  onOpen={onOpenInvoice}
                />
                <Link
                  href={`/finance/invoices/${row.id}`}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon-sm" }),
                    "size-6"
                  )}
                  title="Open invoice page"
                >
                  <ExternalLink className="size-3" />
                </Link>
              </span>
            </td>
            <td className="px-3 py-2">
              <EntityLink href={`/customers/${row.customerId}`}>
                {row.customerName}
              </EntityLink>
              {row.company ? (
                <p className="text-xs text-muted-foreground">{row.company}</p>
              ) : null}
            </td>
            <td className="px-3 py-2">
              {row.projectId ? (
                <EntityLink href={`/projects/${row.projectId}`}>
                  {row.projectName || "Project"}
                </EntityLink>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
              {formatDate(row.dueDate)}
              {row.isOverdue ? (
                <span className="ml-1 text-xs text-red-600 dark:text-red-400">
                  ({row.daysPastDue}d)
                </span>
              ) : null}
            </td>
            <td className="px-3 py-2 text-muted-foreground">
              {bucketLabel[row.agingBucket]}
            </td>
            <td className="px-3 py-2 text-right tabular-nums font-medium">
              {formatCurrency(row.total)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Small helper — unused export kept for optional external CSV of drilldown */
export function DrilldownFooterNote() {
  return null;
}
