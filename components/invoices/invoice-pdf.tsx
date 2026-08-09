"use client";

import { PDFViewer } from "@react-pdf/renderer";
import { InvoicePdfDocument } from "@/components/invoices/invoice-pdf-document";
import type { InvoiceCardFeeDisplay } from "@/lib/invoices/card-fee-display";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

export function InvoicePdfViewer(props: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoSrc: string;
  cardFee?: InvoiceCardFeeDisplay | null;
}) {
  return (
    <PDFViewer width="100%" height="100%" showToolbar>
      <InvoicePdfDocument {...props} />
    </PDFViewer>
  );
}
