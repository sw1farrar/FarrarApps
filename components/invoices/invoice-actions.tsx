"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  deleteInvoice,
  getPaymentReceiptContext,
  recordInvoicePayment,
  updateInvoiceStatus,
  type PaymentReceiptContext,
} from "@/lib/data/invoices";
import { canDeleteInvoice } from "@/lib/invoices/status";
import { formatCurrency } from "@/lib/format";
import type {
  Account,
  CompanySettings,
  Customer,
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
} from "@/lib/types/database";
import { InvoiceEmailDialog } from "@/components/invoices/invoice-email-dialog";
import { PaymentReceiptEmailDialog } from "@/components/invoices/payment-receipt-email-dialog";
import { InvoicePreviewDialog } from "@/components/invoices/invoice-preview-dialog";
import { AccountFormDialog } from "@/components/finance/account-form-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FormSelect } from "@/components/ui/form-select";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function InvoiceActions({
  invoice,
  accounts: initialAccounts,
  customer,
  lines,
  company,
  logoUrl,
  showPreviewButton = true,
  /** Open the send-email dialog on mount (e.g. after creating an invoice). */
  initialEmailOpen = false,
  onChanged,
}: {
  invoice: Invoice;
  accounts: Account[];
  customer: Customer | null;
  lines: InvoiceLineItem[];
  company: CompanySettings | null;
  logoUrl?: string | null;
  showPreviewButton?: boolean;
  initialEmailOpen?: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [accounts, setAccounts] = React.useState(initialAccounts);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [emailOpen, setEmailOpen] = React.useState(
    initialEmailOpen && invoice.status !== "paid"
  );
  const [receiptOpen, setReceiptOpen] = React.useState(false);
  const [receiptCtx, setReceiptCtx] =
    React.useState<PaymentReceiptContext | null>(null);
  const [receiptLoading, setReceiptLoading] = React.useState(false);
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const activeAccounts = accounts.filter((account) => account.is_active);
  const defaultDepositAccountId =
    activeAccounts.find((a) => a.type === "checking")?.id ??
    activeAccounts[0]?.id ??
    "";
  const [accountId, setAccountId] = React.useState(defaultDepositAccountId);

  React.useEffect(() => {
    setAccounts(initialAccounts);
    const active = initialAccounts.filter((a) => a.is_active);
    const preferred =
      active.find((a) => a.type === "checking")?.id ?? active[0]?.id ?? "";
    setAccountId((prev) =>
      prev && active.some((a) => a.id === prev) ? prev : preferred
    );
  }, [initialAccounts]);

  React.useEffect(() => {
    if (!initialEmailOpen) return;
    if (invoice.status === "paid") {
      void openReceiptEmail();
    } else {
      setEmailOpen(true);
    }
  }, [initialEmailOpen, invoice.id]);

  async function openReceiptEmail() {
    setReceiptLoading(true);
    const result = await getPaymentReceiptContext(invoice.id);
    setReceiptLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setReceiptCtx(result.data);
    setReceiptOpen(true);
  }

  async function setStatus(status: InvoiceStatus) {
    if (status === "sent") {
      const ok = await confirm({
        title: "Mark sent without emailing?",
        description:
          "This only updates the invoice status. It does not email the customer. Use “Send via email” to deliver the PDF and pay link.",
        confirmLabel: "Mark sent only",
        cancelLabel: "Cancel",
      });
      if (!ok) return;
    }
    const result = await updateInvoiceStatus(invoice.id, status);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(
        status === "sent"
          ? "Marked sent (no email sent)"
          : `Marked ${status}`
      );
      onChanged?.();
      router.refresh();
    }
  }

  function openRecordPayment() {
    if (activeAccounts.length === 0) {
      toast.error("Add an account first", {
        action: {
          label: "Accounts",
          onClick: () => router.push("/finance/accounts"),
        },
      });
      return;
    }
    const preferred =
      activeAccounts.find((a) => a.type === "checking")?.id ??
      activeAccounts[0]?.id ??
      "";
    setAccountId((prev) =>
      prev && activeAccounts.some((a) => a.id === prev) ? prev : preferred
    );
    setRecordOpen(true);
  }

  async function confirmRecordPayment() {
    const selected = accountId || activeAccounts[0]?.id;
    if (!selected) {
      toast.error("Select an account");
      return;
    }
    setRecording(true);
    const result = await recordInvoicePayment(invoice.id, selected);
    setRecording(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Payment recorded as income");
    setRecordOpen(false);
    onChanged?.();
    router.refresh();
  }

  async function onDelete() {
    if (!canDeleteInvoice(invoice.status)) {
      toast.error("Paid invoices cannot be deleted");
      return;
    }
    const ok = await confirm({
      title: `Delete invoice ${invoice.invoice_number}?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete invoice",
      variant: "destructive",
    });
    if (!ok) return;
    setDeleting(true);
    const result = await deleteInvoice(invoice.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice deleted");
    onChanged?.();
    router.push("/finance/invoices");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {invoice.status === "draft" && (
          <>
            <Link
              href={`/finance/invoices/${invoice.id}/edit`}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Edit
            </Link>
            <Button size="sm" onClick={() => setEmailOpen(true)}>
              Send via email
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStatus("sent")}
              title="Updates status only — does not email the customer"
            >
              Mark sent (no email)
            </Button>
          </>
        )}
        {(invoice.status === "sent" || invoice.status === "overdue") &&
          (activeAccounts.length === 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <AccountFormDialog
                onCreated={(created) => {
                  const next = {
                    id: created.id,
                    name: created.name,
                    type: "checking" as const,
                    opening_balance: 0,
                    is_active: true,
                  } as Account;
                  setAccounts((prev) => [...prev, next]);
                  setAccountId(created.id);
                }}
                trigger={
                  <Button size="sm" variant="outline">
                    Add account to record payment
                  </Button>
                }
              />
              <Link
                href="/finance/accounts"
                className={buttonVariants({ size: "sm", variant: "ghost" })}
              >
                Manage accounts
              </Link>
            </div>
          ) : (
            <Button size="sm" onClick={openRecordPayment}>
              Record payment
            </Button>
          ))}
        {invoice.status === "sent" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStatus("overdue")}
          >
            Mark overdue
          </Button>
        )}
        {showPreviewButton ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPreviewOpen(true)}
          >
            Preview
          </Button>
        ) : null}
        {invoice.status === "paid" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={receiptLoading}
            onClick={() => void openReceiptEmail()}
          >
            {receiptLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Email receipt
          </Button>
        ) : invoice.status !== "draft" ? (
          <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
            Send via email
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(`/invoice-pdf/${invoice.id}`, "_blank")}
        >
          Download PDF
        </Button>
        {canDeleteInvoice(invoice.status) ? (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={deleting}
            onClick={() => void onDelete()}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        ) : null}
      </div>

      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border px-4 py-3 sm:px-5">
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              For offline payments (check, wire, cash). Online card pays go to
              Stripe automatically via the pay link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-4 sm:px-5">
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
              <p className="font-medium">{invoice.invoice_number}</p>
              <p className="text-muted-foreground">
                {formatCurrency(invoice.total)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deposit-account">Deposit account</Label>
              <FormSelect
                id="deposit-account"
                value={accountId}
                onValueChange={setAccountId}
                aria-label="Deposit account"
                options={activeAccounts.map((account) => ({
                  value: account.id,
                  label: account.name,
                }))}
                placeholder="Select account"
              />
              <p className="text-[11px] text-muted-foreground">
                Where the money landed. Marks this invoice paid and posts
                income to that account.
              </p>
            </div>
          </div>
          <DialogFooter className="border-t border-border px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRecordOpen(false)}
              disabled={recording}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void confirmRecordPayment()}
              disabled={recording || !accountId}
            >
              {recording ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Record {formatCurrency(invoice.total)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InvoicePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        invoice={invoice}
        lines={lines}
        customer={customer}
        company={company}
        logoUrl={logoUrl}
      />

      <InvoiceEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        invoice={invoice}
        lines={lines}
        customer={customer}
        company={company}
        logoUrl={logoUrl}
        onSent={onChanged}
      />

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
          onSent={onChanged}
        />
      ) : null}
    </>
  );
}
