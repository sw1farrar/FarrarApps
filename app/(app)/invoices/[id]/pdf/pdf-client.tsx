"use client";

import { useEffect, useState } from "react";
import { InvoicePdfViewer } from "@/components/invoices/invoice-pdf";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

export default function InvoicePdfClient({
  invoice,
  lines,
  customer,
  company,
}: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
}) {
  const [logoSrc, setLogoSrc] = useState("/farrar_apps_logo.png");

  useEffect(() => {
    setLogoSrc(`${window.location.origin}/farrar_apps_logo.png`);
  }, []);

  return (
    <div className="h-svh w-full bg-background">
      <InvoicePdfViewer
        invoice={invoice}
        lines={lines}
        customer={customer}
        company={company}
        logoSrc={logoSrc}
      />
    </div>
  );
}
