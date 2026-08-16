"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { InvoiceCardFeeDisplay } from "@/lib/invoices/card-fee-display";
import type {
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
} from "@/lib/types/database";

const InvoicePdfViewer = dynamic(
  () =>
    import("@/components/invoices/invoice-pdf").then(
      (mod) => mod.InvoicePdfViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading PDF viewer…
      </div>
    ),
  }
);

export default function InvoicePdfClient({
  invoice,
  lines,
  customer,
  company,
  initialLogoSrc,
  cardFee,
  includeCardRemittance = false,
}: {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  customer: Customer | null;
  company: CompanySettings | null;
  initialLogoSrc?: string;
  cardFee?: InvoiceCardFeeDisplay | null;
  includeCardRemittance?: boolean;
}) {
  const [logoSrc, setLogoSrc] = useState(
    initialLogoSrc || "/farrar_apps_logo.png"
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!initialLogoSrc) {
      setLogoSrc(`${window.location.origin}/farrar_apps_logo.png`);
    }
  }, [initialLogoSrc]);

  return (
    <div className="h-svh w-full bg-background">
      {mounted ? (
        <InvoicePdfViewer
          invoice={invoice}
          lines={lines}
          customer={customer}
          company={company}
          logoSrc={logoSrc}
          cardFee={cardFee}
          includeCardRemittance={includeCardRemittance}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading PDF viewer…
        </div>
      )}
    </div>
  );
}
