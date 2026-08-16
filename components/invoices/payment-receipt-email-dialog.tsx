"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  downloadPaymentReceiptPdf,
  resendPaymentReceipt,
} from "@/lib/data/invoices";
import { formatCurrency } from "@/lib/format";
import type { InvoiceCardFeeDisplay } from "@/lib/invoices/card-fee-display";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";
import { PaymentReceiptEmailPreview } from "@/components/invoices/payment-receipt-email-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PaymentReceiptEmailDialog({
  open,
  onOpenChange,
  invoice,
  lines,
  customer,
  company,
  logoUrl,
  invoiceAmount,
  feeAmount,
  chargeAmount,
  paidAt,
  fromStripe,
  cardFee,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoUrl?: string | null;
  invoiceAmount: number;
  feeAmount: number;
  chargeAmount: number;
  paidAt?: string | null;
  fromStripe?: boolean;
  cardFee?: InvoiceCardFeeDisplay | null;
  onSent?: () => void;
}) {
  const router = useRouter();
  const [recipient, setRecipient] = React.useState(customer?.email || "");
  const [sending, setSending] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setRecipient(customer?.email || "");
  }, [open, customer?.email]);

  async function onSend() {
    if (!recipient.trim()) {
      toast.error("Enter a recipient email");
      return;
    }
    setSending(true);
    const result = await resendPaymentReceipt({
      invoiceId: invoice.id,
      toEmail: recipient.trim(),
    });
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message || "Receipt emailed");
    onOpenChange(false);
    onSent?.();
    router.refresh();
  }

  async function onDownload() {
    setDownloading(true);
    const result = await downloadPaymentReceiptPdf(invoice.id);
    setDownloading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    try {
      const bytes = Uint8Array.from(atob(result.contentBase64), (c) =>
        c.charCodeAt(0)
      );
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Receipt PDF downloaded");
    } catch {
      toast.error("Could not save the receipt PDF");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,90vh)] w-[calc(100vw-2rem)] max-w-5xl gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
          <DialogTitle>Resend payment receipt</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="shrink-0 space-y-3 overflow-y-auto border-b border-border p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="space-y-1.5">
              <Label htmlFor="receipt-email-to">Recipient</Label>
              <Input
                id="receipt-email-to"
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="client@example.com"
                required
              />
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {feeAmount > 0
                ? "Receipt includes the card fee. Invoice PDF does not."
                : fromStripe
                  ? "Online payment. No card fee."
                  : "Offline payment. No card fee."}
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Invoice</dt>
                <dd className="tabular-nums font-medium">
                  {formatCurrency(invoiceAmount)}
                </dd>
              </div>
              {feeAmount > 0 ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Card fee</dt>
                  <dd className="tabular-nums font-medium">
                    {formatCurrency(feeAmount)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2 border-t border-border pt-1.5">
                <dt className="font-medium">Total paid</dt>
                <dd className="tabular-nums font-semibold">
                  {formatCurrency(chargeAmount)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain bg-[#f7f7f4] p-4 sm:p-5">
            <PaymentReceiptEmailPreview
              invoice={invoice}
              lines={lines}
              customer={customer}
              company={company}
              logoUrl={logoUrl}
              recipient={recipient}
              invoiceAmount={invoiceAmount}
              feeAmount={feeAmount}
              chargeAmount={chargeAmount}
              paidAt={paidAt}
              cardFee={cardFee}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={sending || downloading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void onDownload()}
            disabled={sending || downloading}
          >
            {downloading ? <Loader2 className="size-4 animate-spin" /> : null}
            Download receipt PDF
          </Button>
          <Button
            type="button"
            onClick={() => void onSend()}
            disabled={sending || downloading}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : null}
            Send receipt with PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
