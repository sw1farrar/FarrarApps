"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvoicePaperPreview } from "@/components/invoices/invoice-paper-preview";
import type { InvoiceCardFeeDisplay } from "@/lib/invoices/card-fee-display";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

export function InvoicePreviewDialog({
  open,
  onOpenChange,
  invoice,
  lines,
  customer,
  company,
  logoUrl,
  cardFee,
  includeCardRemittance = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoUrl?: string | null;
  cardFee?: InvoiceCardFeeDisplay | null;
  includeCardRemittance?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,90vh)] w-[calc(100vw-2rem)] max-w-2xl gap-0 overflow-hidden bg-[#f3f3f1] p-0 text-[#1a1a1a]">
        <DialogHeader className="shrink-0 border-b border-[#e5e5e5] bg-white px-4 py-3">
          <DialogTitle className="text-sm font-medium text-[#1a1a1a]">
            Invoice preview
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <InvoicePaperPreview
            invoice={invoice}
            lines={lines}
            customer={customer}
            company={company}
            logoUrl={logoUrl}
            cardFee={cardFee}
            includeCardRemittance={includeCardRemittance}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
