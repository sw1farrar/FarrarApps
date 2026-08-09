"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Transaction } from "@/lib/types/database";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { InvoiceWorkbenchDialog } from "@/components/invoices/invoice-workbench-dialog";

/**
 * Wraps the transactions table and opens the invoice workbench when an
 * invoice number is requested (via custom event or future row hook).
 * For now exposes open by invoice id from description clicks in a thin shell.
 */
export function TransactionsInvoiceLinks({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = React.useState<string | null>(null);

  React.useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ invoiceId?: string }>).detail;
      if (detail?.invoiceId) setInvoiceId(detail.invoiceId);
    }
    window.addEventListener("fa:open-invoice", onOpen);
    return () => window.removeEventListener("fa:open-invoice", onOpen);
  }, []);

  return (
    <>
      <TransactionsTable
        transactions={transactions}
        onInvoiceClick={(id) => setInvoiceId(id)}
      />
      <InvoiceWorkbenchDialog
        invoiceId={invoiceId}
        open={Boolean(invoiceId)}
        onOpenChange={(open) => {
          if (!open) setInvoiceId(null);
        }}
        onChanged={() => router.refresh()}
      />
    </>
  );
}
