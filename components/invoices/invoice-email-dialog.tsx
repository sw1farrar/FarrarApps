"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sendInvoiceEmail } from "@/lib/data/invoices";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";
import { InvoiceEmailPreview } from "@/components/invoices/invoice-email-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function defaultMessage(
  invoice: Invoice,
  customer: Customer | null,
  company: CompanySettings | null
) {
  const companyName = company?.name || "Farrar Apps";
  const customerName = customer?.name || "there";
  return `Hi ${customerName},

Please find invoice ${invoice.invoice_number} attached. The total due is ${formatCurrency(invoice.total)} and payment is due by ${formatDate(invoice.due_date)}.

Thank you,
${companyName}`;
}

export function InvoiceEmailDialog({
  open,
  onOpenChange,
  invoice,
  lines,
  customer,
  company,
  logoUrl,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoUrl?: string | null;
  onSent?: () => void;
}) {
  const router = useRouter();
  const [recipient, setRecipient] = React.useState(customer?.email || "");
  const [message, setMessage] = React.useState(
    defaultMessage(invoice, customer, company)
  );
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setRecipient(customer?.email || "");
    setMessage(defaultMessage(invoice, customer, company));
  }, [open, customer, company, invoice]);

  async function onSend() {
    if (!recipient.trim()) {
      toast.error("Enter a recipient email");
      return;
    }
    setSending(true);
    const result = await sendInvoiceEmail({
      invoiceId: invoice.id,
      toEmail: recipient.trim(),
      message: message.trim(),
    });
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message || "Invoice emailed");
    onOpenChange(false);
    onSent?.();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,90vh)] w-[calc(100vw-2rem)] max-w-5xl gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
          <DialogTitle>Send invoice by email</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="shrink-0 space-y-3 overflow-y-auto border-b border-border p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="space-y-1.5">
              <Label htmlFor="invoice-email-to">Recipient</Label>
              <Input
                id="invoice-email-to"
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="client@example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-email-message">Message</Label>
              <Textarea
                id="invoice-email-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="min-h-[140px] resize-y"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              PDF attached. Pay link added when sent.
            </p>
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain bg-[#f7f7f4] p-4 sm:p-5">
            <InvoiceEmailPreview
              invoice={invoice}
              lines={lines}
              customer={customer}
              company={company}
              logoUrl={logoUrl}
              message={message}
              recipient={recipient}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onSend} disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : null}
            Send email with PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
