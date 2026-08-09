import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdfDocument } from "@/components/invoices/invoice-pdf-document";
import type { InvoiceCardFeeDisplay } from "@/lib/invoices/card-fee-display";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

export async function renderInvoicePdfBuffer(input: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  logoSrc: string;
  cardFee?: InvoiceCardFeeDisplay | null;
}) {
  return renderToBuffer(
    <InvoicePdfDocument
      invoice={input.invoice}
      lines={input.lines}
      customer={input.customer}
      company={input.company}
      logoSrc={input.logoSrc}
      cardFee={input.cardFee}
    />
  );
}
