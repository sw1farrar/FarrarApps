"use client";

import * as React from "react";
import { Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PortalPayInvoiceButton({
  invoiceId,
  disabled,
}: {
  invoiceId: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = React.useState(false);

  async function onPay() {
    setPending(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error || "Could not start checkout");
        return;
      }
      window.location.assign(data.url);
    } catch {
      toast.error("Could not start checkout");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="default"
      disabled={disabled || pending}
      onClick={() => void onPay()}
      className="gap-1.5"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <CreditCard className="size-3.5" />
      )}
      Pay
    </Button>
  );
}
