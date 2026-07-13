"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  recordInvoicePayment,
  sendInvoiceEmail,
  updateInvoiceStatus,
} from "@/lib/data/invoices";
import type { Account, Invoice, InvoiceStatus } from "@/lib/types/database";
import { Button } from "@/components/ui/button";

export function InvoiceActions({
  invoice,
  accounts,
}: {
  invoice: Invoice;
  accounts: Account[];
}) {
  const router = useRouter();

  async function setStatus(status: InvoiceStatus) {
    const result = await updateInvoiceStatus(invoice.id, status);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(`Marked ${status}`);
      router.refresh();
    }
  }

  async function markPaid() {
    const accountId = accounts[0]?.id;
    if (!accountId) {
      toast.error("Create an account first");
      return;
    }
    const result = await recordInvoicePayment(invoice.id, accountId);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Payment recorded as income");
      router.refresh();
    }
  }

  async function sendEmail() {
    const result = await sendInvoiceEmail(invoice.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message || "Invoice emailed");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {invoice.status === "draft" && (
        <Button size="sm" onClick={() => setStatus("sent")}>
          Mark sent
        </Button>
      )}
      {(invoice.status === "sent" || invoice.status === "overdue") && (
        <Button size="sm" onClick={markPaid}>
          Record payment
        </Button>
      )}
      {invoice.status === "sent" && (
        <Button size="sm" variant="outline" onClick={() => setStatus("overdue")}>
          Mark overdue
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={sendEmail}>
        Send via email
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => window.open(`/invoice-pdf/${invoice.id}`, "_blank")}
      >
        Download PDF
      </Button>
    </div>
  );
}
