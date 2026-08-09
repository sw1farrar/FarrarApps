"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Download, Loader2, Trash2 } from "lucide-react";
import { deleteInvoice } from "@/lib/data/invoices";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  canDeleteInvoice,
  displayInvoiceStatus,
  formatInvoiceAging,
  invoiceStatusBadgeClass,
} from "@/lib/invoices/status";
import type { Invoice } from "@/lib/types/database";
import { InvoiceListEmailButton } from "@/components/invoices/invoice-list-email-button";
import { InvoiceWorkbenchDialog } from "@/components/invoices/invoice-workbench-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type InvoiceListRow = Pick<
  Invoice,
  "id" | "invoice_number" | "status" | "issue_date" | "due_date" | "total"
> & {
  customers?: { id: string; name: string } | null;
};

export function InvoicesTableClient({
  invoices,
  emptyMessage = "No invoices yet",
  showCustomer = true,
  className,
}: {
  invoices: InvoiceListRow[];
  emptyMessage?: string;
  showCustomer?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function onDelete(invoice: InvoiceListRow) {
    if (!canDeleteInvoice(invoice.status)) {
      toast.error("Paid invoices cannot be deleted");
      return;
    }
    const ok = await confirm({
      title: `Delete invoice ${invoice.invoice_number}?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete invoice",
      variant: "destructive",
    });
    if (!ok) return;
    setDeletingId(invoice.id);
    const result = await deleteInvoice(invoice.id);
    setDeletingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice deleted");
    if (openId === invoice.id) setOpenId(null);
    router.refresh();
  }

  if (invoices.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border px-4 py-16 text-center",
          className
        )}
      >
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn("overflow-x-auto rounded-lg border border-border", className)}>
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              {showCustomer ? <TableHead>Customer</TableHead> : null}
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aging</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const label = displayInvoiceStatus(
                invoice.status,
                invoice.due_date
              );
              const canDelete = canDeleteInvoice(invoice.status);
              return (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  aria-label={`Preview invoice ${invoice.invoice_number}`}
                  onClick={() => setOpenId(invoice.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOpenId(invoice.id);
                    }
                  }}
                >
                  <TableCell className="font-medium font-mono text-sm">
                    {invoice.invoice_number}
                  </TableCell>
                  {showCustomer ? (
                    <TableCell className="text-muted-foreground">
                      {invoice.customers?.name || "—"}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCurrency(invoice.total)}
                  </TableCell>
                  <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                  <TableCell>{formatDate(invoice.due_date)}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "gap-1 text-xs",
                        invoiceStatusBadgeClass(
                          invoice.status,
                          invoice.due_date
                        )
                      )}
                    >
                      {label === "Paid" ? (
                        <CheckCircle2 className="size-3" />
                      ) : null}
                      {label}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-sm tabular-nums",
                      label === "Past due" &&
                        "font-medium text-orange-700 dark:text-orange-400"
                    )}
                  >
                    {formatInvoiceAging(invoice.due_date, invoice.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex justify-end gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <InvoiceListEmailButton invoice={invoice} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Download PDF"
                        onClick={() =>
                          window.open(
                            `/invoice-pdf/${invoice.id}`,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        <Download className="size-4" />
                      </Button>
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          title="Delete invoice"
                          disabled={deletingId === invoice.id}
                          onClick={() => void onDelete(invoice)}
                        >
                          {deletingId === invoice.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <InvoiceWorkbenchDialog
        invoiceId={openId}
        open={Boolean(openId)}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
        onChanged={() => router.refresh()}
      />
    </>
  );
}
