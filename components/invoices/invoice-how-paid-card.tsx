"use client";

import * as React from "react";
import { formatCurrency } from "@/lib/format";
import type { InvoiceCardFeeDisplay } from "@/lib/invoices/card-fee-display";
import {
  remittanceCompanyName,
  remittanceCopy,
} from "@/lib/invoices/card-fee-remittance";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";
import { PaymentReceiptEmailDialog } from "@/components/invoices/payment-receipt-email-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function InvoiceHowPaidCard({
  invoice,
  lines,
  customer,
  company,
  logoUrl,
  cardFee,
}: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoUrl?: string | null;
  cardFee: InvoiceCardFeeDisplay;
}) {
  const [open, setOpen] = React.useState(false);
  const companyName = remittanceCompanyName(company?.name);
  const copy = remittanceCopy(companyName);

  return (
    <>
      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">{copy.heading}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-0">
          <p className="text-xs leading-relaxed text-muted-foreground">
            The invoice total is the amount {companyName} received. The card
            fee was paid to Stripe and is not company income.
          </p>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{copy.paidToLabel}</dt>
              <dd className="tabular-nums font-medium">
                {formatCurrency(cardFee.invoiceAmount)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{copy.feeLabel}</dt>
              <dd className="tabular-nums font-medium">
                {formatCurrency(cardFee.feeAmount)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-1.5">
              <dt className="font-medium">{copy.cardTotalLabel}</dt>
              <dd className="tabular-nums font-semibold">
                {formatCurrency(cardFee.chargeAmount)}
              </dd>
            </div>
          </dl>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpen(true)}
          >
            View / email receipt
          </Button>
        </CardContent>
      </Card>

      <PaymentReceiptEmailDialog
        open={open}
        onOpenChange={setOpen}
        invoice={invoice}
        lines={lines}
        customer={customer}
        company={company}
        logoUrl={logoUrl}
        invoiceAmount={cardFee.invoiceAmount}
        feeAmount={cardFee.feeAmount}
        chargeAmount={cardFee.chargeAmount}
        paidAt={cardFee.paidAt || invoice.paid_at}
        fromStripe
        cardFee={cardFee}
      />
    </>
  );
}
