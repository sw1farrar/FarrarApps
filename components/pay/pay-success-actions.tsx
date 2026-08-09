"use client";

import * as React from "react";
import { Download, Loader2, Mail, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Guest success actions: print confirmation, download PDF, resend receipt email.
 */
export function PaySuccessActions({
  token,
  invoiceId,
  customerEmail,
}: {
  token: string;
  invoiceId: string;
  customerEmail?: string | null;
}) {
  const [emailing, setEmailing] = React.useState(false);

  function onPrint() {
    window.print();
  }

  function onDownload() {
    window.open(
      `/pay/${encodeURIComponent(token)}/receipt`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function onEmailReceipt() {
    setEmailing(true);
    try {
      const res = await fetch(`/pay/${encodeURIComponent(token)}/email-receipt`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Could not email receipt");
        return;
      }
      toast.success(
        data.message ||
          (customerEmail
            ? `Receipt emailed to ${customerEmail}`
            : "Receipt emailed")
      );
    } catch {
      toast.error("Could not email receipt");
    } finally {
      setEmailing(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-2 print:hidden sm:flex-row sm:justify-center">
      <Button type="button" size="sm" variant="outline" onClick={onPrint}>
        <Printer className="size-4" />
        Print confirmation
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onDownload}>
        <Download className="size-4" />
        Download PDF
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={() => void onEmailReceipt()}
        disabled={emailing}
      >
        {emailing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Mail className="size-4" />
        )}
        Email receipt
      </Button>
    </div>
  );
}
