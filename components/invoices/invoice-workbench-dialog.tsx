"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import {
  getInvoiceWorkbenchData,
  type InvoiceWorkbenchData,
} from "@/lib/data/invoices";
import { formatDate, titleCase } from "@/lib/format";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { InvoicePaperPreview } from "@/components/invoices/invoice-paper-preview";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function InvoiceWorkbenchDialog({
  invoiceId,
  open,
  onOpenChange,
  onChanged,
}: {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<InvoiceWorkbenchData | null>(null);
  const loadSeq = React.useRef(0);

  const load = React.useCallback(async (id: string) => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    const result = await getInvoiceWorkbenchData(id);
    if (seq !== loadSeq.current) return;
    setLoading(false);
    if (!result.ok) {
      setData(null);
      setError(result.error);
      return;
    }
    setData(result.data);
  }, []);

  React.useEffect(() => {
    if (!open || !invoiceId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    void load(invoiceId);
  }, [open, invoiceId, load]);

  function handleChanged() {
    if (invoiceId) void load(invoiceId);
    onChanged?.();
  }

  const invoice = data?.invoice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,90vh)] w-[calc(100vw-2rem)] max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-2 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-base">
                {invoice?.invoice_number ?? "Invoice"}
              </DialogTitle>
              {invoice ? (
                <p className="text-xs text-muted-foreground">
                  {invoice.customers?.name || data?.customer?.name || "—"}
                  {" · "}
                  issued {formatDate(invoice.issue_date)}
                  {" · "}
                  due {formatDate(invoice.due_date)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {loading ? "Loading invoice…" : "Invoice preview"}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {invoice ? (
                <Badge variant="secondary">{titleCase(invoice.status)}</Badge>
              ) : null}
              {invoiceId ? (
                <Link
                  href={`/finance/invoices/${invoiceId}`}
                  className={cn(
                    buttonVariants({ size: "sm", variant: "ghost" }),
                    "gap-1.5"
                  )}
                  onClick={() => onOpenChange(false)}
                >
                  Full page
                  <ExternalLink className="size-3.5" />
                </Link>
              ) : null}
            </div>
          </div>

          {data ? (
            <InvoiceActions
              invoice={data.invoice}
              accounts={data.accounts}
              customer={data.customer}
              lines={data.lines}
              company={data.company}
              logoUrl={data.logoUrl}
              cardFee={data.cardFee}
              showPreviewButton={false}
              onChanged={handleChanged}
            />
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f3f3f1]">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-4 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              {invoiceId ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => void load(invoiceId)}
                >
                  <RefreshCw className="size-3.5" />
                  Retry
                </Button>
              ) : null}
            </div>
          ) : data ? (
            <InvoicePaperPreview
              invoice={data.invoice}
              lines={data.lines}
              customer={data.customer}
              company={data.company}
              logoUrl={data.logoUrl}
              cardFee={data.cardFee}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
