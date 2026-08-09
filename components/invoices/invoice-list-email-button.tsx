"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  getInvoiceWorkbenchData,
  getPaymentReceiptContext,
  type InvoiceWorkbenchData,
  type PaymentReceiptContext,
} from "@/lib/data/invoices";
import type { InvoiceListRow } from "@/components/invoices/invoices-table-client";
import { InvoiceEmailDialog } from "@/components/invoices/invoice-email-dialog";
import { PaymentReceiptEmailDialog } from "@/components/invoices/payment-receipt-email-dialog";
import { Button } from "@/components/ui/button";

/**
 * Row action: open invoice email preview (unpaid) or payment receipt resend (paid).
 */
export function InvoiceListEmailButton({
  invoice,
}: {
  invoice: InvoiceListRow;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [invoiceCtx, setInvoiceCtx] =
    React.useState<InvoiceWorkbenchData | null>(null);
  const [receiptCtx, setReceiptCtx] =
    React.useState<PaymentReceiptContext | null>(null);
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);
  const [receiptOpen, setReceiptOpen] = React.useState(false);

  async function openEmail(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      if (invoice.status === "paid") {
        const result = await getPaymentReceiptContext(invoice.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setReceiptCtx(result.data);
        setReceiptOpen(true);
      } else {
        const result = await getInvoiceWorkbenchData(invoice.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setInvoiceCtx(result.data);
        setInvoiceOpen(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        title={
          invoice.status === "paid"
            ? "Email payment receipt"
            : "Email invoice"
        }
        aria-label={
          invoice.status === "paid"
            ? `Email receipt for ${invoice.invoice_number}`
            : `Email invoice ${invoice.invoice_number}`
        }
        disabled={loading}
        onClick={(e) => void openEmail(e)}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Mail className="size-4" />
        )}
      </Button>

      {invoiceCtx ? (
        <InvoiceEmailDialog
          open={invoiceOpen}
          onOpenChange={(open) => {
            setInvoiceOpen(open);
            if (!open) setInvoiceCtx(null);
          }}
          invoice={invoiceCtx.invoice}
          lines={invoiceCtx.lines}
          customer={invoiceCtx.customer}
          company={invoiceCtx.company}
          logoUrl={invoiceCtx.logoUrl}
          onSent={() => router.refresh()}
        />
      ) : null}

      {receiptCtx ? (
        <PaymentReceiptEmailDialog
          open={receiptOpen}
          onOpenChange={(open) => {
            setReceiptOpen(open);
            if (!open) setReceiptCtx(null);
          }}
          invoice={receiptCtx.invoice}
          lines={receiptCtx.lines}
          customer={receiptCtx.customer}
          company={receiptCtx.company}
          logoUrl={receiptCtx.logoUrl}
          invoiceAmount={receiptCtx.invoiceAmount}
          feeAmount={receiptCtx.feeAmount}
          chargeAmount={receiptCtx.chargeAmount}
          paidAt={receiptCtx.paidAt}
          fromStripe={receiptCtx.fromStripe}
          cardFee={receiptCtx.cardFee}
          onSent={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
